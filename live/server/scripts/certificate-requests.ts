/** Operator-only review. Run inside the certificate service; never exposes an admin HTTP route. */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { ShopifyAdminClient } from '../src/certificates/shopify.js';
import { CertificateService } from '../src/certificates/service.js';
import { PythonCertificateGenerator } from '../src/certificates/pdf.js';
import { ResendCertificateMailer } from '../src/certificates/mailer.js';
import { deliverCertificateRequest, findRequestOrder, type RequestOrder } from '../src/certificates/requests.js';

const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
  const [action,id,filename]=process.argv.slice(2);
  if(action==='list'){
    console.log(JSON.stringify((await pool.query(`SELECT id,order_name,email,reason,created_at FROM certificate_requests WHERE status='needs_review' ORDER BY created_at`)).rows,null,2));
  }else if(action==='issue'&&id&&filename){
    // Use an order JSON exported from the authenticated Shopify admin. Never accept a customer-supplied file.
    const raw=JSON.parse(await readFile(filename,'utf8')).order;
    if(!raw?.admin_graphql_api_id||!Array.isArray(raw.line_items))throw new Error('Expected a Shopify admin order JSON export');
    const order:RequestOrder={id:raw.admin_graphql_api_id,name:raw.name,email:raw.contact_email||raw.email||null,
      cancelledAt:raw.cancelled_at,displayFinancialStatus:String(raw.financial_status).toUpperCase(),
      displayFulfillmentStatus:String(raw.fulfillment_status).toUpperCase(),lineItems:{pageInfo:{hasNextPage:false},
        nodes:raw.line_items.map((line:any)=>({id:line.admin_graphql_api_id||`gid://shopify/LineItem/${line.id}`,title:line.title,
          vendor:line.vendor,sku:line.sku,quantity:line.quantity,currentQuantity:line.current_quantity,
          product:line.product_id?{id:`gid://shopify/Product/${line.product_id}`}:null}))}};
    const {rows}=await pool.query(`UPDATE certificate_requests SET status='processing',processing_started_at=now(),attempts=attempts+1
      WHERE id=$1 AND status='needs_review' RETURNING id,order_name,email,attempts`,[id]);
    if(!rows[0])throw new Error('Request is not awaiting review');
    const shopify=new ShopifyAdminClient(process.env.SHOPIFY_STORE_DOMAIN!,{clientId:process.env.SHOPIFY_CLIENT_ID!,clientSecret:process.env.SHOPIFY_CLIENT_SECRET!});
    const mailer=new ResendCertificateMailer(process.env.RESEND_API_KEY!,process.env.CERTIFICATE_FROM_EMAIL!);
    const baseUrl=process.env.PUBLIC_BASE_URL!.replace(/\/$/,'');
    const service=new CertificateService(pool,shopify,new PythonCertificateGenerator(process.env.CERTIFICATE_STORAGE_DIR!,process.env.CERTIFICATE_PYTHON_BIN||'python3'),mailer,baseUrl);
    try{await deliverCertificateRequest(pool,rows[0],order,{findOrder:name=>findRequestOrder(shopify,name),service,mailer,baseUrl});}
    catch(error){await pool.query(`UPDATE certificate_requests SET status='needs_review',reason='operator_processing_failed',processing_started_at=NULL WHERE id=$1`,[id]);throw error;}
    console.log((await pool.query('SELECT id,status,reason FROM certificate_requests WHERE id=$1',[id])).rows[0]);
  }else throw new Error('Usage: node --import tsx scripts/certificate-requests.ts list | issue REQUEST_ID TRUSTED_SHOPIFY_ORDER.json');
}finally{await pool.end();}
