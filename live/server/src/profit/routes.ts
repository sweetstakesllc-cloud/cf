import type {FastifyInstance} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import type {ShopifyAdminClient} from '../certificates/shopify.js';
import {verifyShopifyToken} from './auth.js';
import {calculateOrder,minor,type ProfitOrder,type Cost,type Adjustments} from './model.js';
import {profitPage,profitScript} from './view.js';

type Config={clientId:string;clientSecret:string;store:string;previewToken?:string;sync():Promise<unknown>};
const amount=z.number().finite().min(0).max(10000000).multipleOf(0.01);
const gid=z.string().regex(/^gid:\/\/shopify\/[A-Za-z]+\/\d+$/);
export function registerProfitRoutes(app:FastifyInstance,pool:pg.Pool,shopify:ShopifyAdminClient,config:Config){
 app.get('/profit',async(_request,reply)=>reply.header('Cache-Control','no-store').header('Content-Security-Policy',`frame-ancestors https://admin.shopify.com https://${config.store}`).type('text/html').send(profitPage(config.clientId,config.store,!!config.previewToken)));
 app.get('/profit/app.js',async(_request,reply)=>reply.type('application/javascript').send(profitScript));
 app.register(async protectedApp=>{
  protectedApp.addHook('preHandler',async(request,reply)=>{
   reply.header('Cache-Control','no-store');const token=request.headers.authorization?.replace(/^Bearer /,'')||'';
   const local=config.previewToken&&token===config.previewToken&&['127.0.0.1','::1'].includes(request.ip);
   const actor=local?'local-preview':verifyShopifyToken(token,config.clientId,config.clientSecret,config.store);
   if(!actor)return reply.code(401).send({error:'Open this dashboard from your Shopify admin.'});
   (request as any).profitActor=actor;
  });
  const audit=async(actor:string,action:string,details:unknown)=>{await pool.query('INSERT INTO profit_audit(actor,action,details) VALUES($1,$2,$3)',[actor,action,JSON.stringify(details)]);};
  protectedApp.get('/profit/api/report',async(request,reply)=>{
   const parsed=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).safeParse(request.query);
   if(!parsed.success||parsed.data.from>parsed.data.to)return reply.code(400).send({error:'Choose a valid date range.'});
   const {from,to}=parsed.data;
   const [orders,costs,adjustments,expenses,missing,state]=await Promise.all([
    pool.query(`SELECT id,data FROM profit_orders WHERE (processed_at AT TIME ZONE 'Europe/Stockholm')::date BETWEEN $1::date AND $2::date ORDER BY processed_at DESC`,[from,to]),
    pool.query('SELECT order_id,line_id,variant_id,unit_cost,source FROM profit_costs'),pool.query('SELECT * FROM profit_adjustments'),
    pool.query('SELECT id,day::text,category,description,amount FROM profit_expenses WHERE day BETWEEN $1::date AND $2::date ORDER BY day DESC',[from,to]),
    pool.query(`SELECT id,product_id,title,sku,quantity FROM profit_variants WHERE active AND cost IS NULL ORDER BY (quantity>0) DESC,title`),pool.query('SELECT key,value FROM profit_state')]);
   const settings=state.rows.find(r=>r.key==='settings')?.value||{};
   const rows=orders.rows.map(r=>{
    const a=adjustments.rows.find(a=>a.order_id===r.id);const adjusted={...a};let defaults=false;
    if(adjusted.shipping_cost==null&&settings.shippingDefault!=null){adjusted.shipping_cost=settings.shippingDefault;defaults=true;}
    if(adjusted.packaging_cost==null&&settings.packagingDefault!=null){adjusted.packaging_cost=settings.packagingDefault;defaults=true;}
    const calculated=calculateOrder(r.data as ProfitOrder,costs.rows.filter(c=>c.order_id===r.id) as Cost[],adjusted as Adjustments);
    if(defaults){calculated.notes.push('Uses estimated shipping / packaging defaults');calculated.complete=false;}
    return {...calculated,adjustments:a||null};
   });
   const included=rows.filter(r=>r.eligible);const periods=new Map<string,any>();
   for(const row of included){const p=periods.get(row.day)||{day:row.day,orders:0,revenue:0,tax:0,beforeVat:0,netSales:0,cogs:0,fees:0,result:0,missing:0};p.orders++;p.revenue+=row.revenue;p.tax+=row.tax;p.beforeVat+=row.knownCostsBeforeVat;p.netSales+=row.netSales;p.cogs+=row.cogs;p.fees+=row.fees;p.result+=row.knownCostsResult;if(!row.complete)p.missing++;periods.set(row.day,p);}
   const totals={orders:included.length,revenue:0,tax:0,beforeVat:0,netSales:0,cogs:0,fees:0,shipping:0,packaging:0,result:0,refunds:0,expenses:0,incomplete:0,missingCost:0,missingFees:0,missingShipping:0,missingPackaging:0};
   for(const row of included){for(const key of ['netSales','cogs','fees','result','refunds'] as const)totals[key]+=key==='result'?row.knownCostsResult:row[key];totals.revenue+=row.revenue;totals.tax+=row.tax;totals.beforeVat+=row.knownCostsBeforeVat;totals.shipping+=row.shipping||0;totals.packaging+=row.packaging||0;if(!row.complete)totals.incomplete++;totals.missingCost+=row.missingCost;if(row.missingFees)totals.missingFees++;if(row.shipping==null)totals.missingShipping++;if(row.packaging==null)totals.missingPackaging++;}
   for(const expense of expenses.rows){const day=expense.day;const p=periods.get(day)||{day,orders:0,revenue:0,tax:0,beforeVat:0,netSales:0,cogs:0,fees:0,result:0,missing:0};p.result-=Number(expense.amount);p.beforeVat-=Number(expense.amount);periods.set(day,p);}
   totals.expenses=expenses.rows.reduce((sum,r)=>sum+Number(r.amount),0);totals.result-=totals.expenses;totals.beforeVat-=totals.expenses;
   const methods=new Map<string,{method:string;orders:number;fees:number;missing:number}>();for(const row of included){const name=row.methods.join(' + ')||'Unknown';const m=methods.get(name)||{method:name,orders:0,fees:0,missing:0};m.orders++;m.fees+=row.fees;if(row.missingFees)m.missing++;methods.set(name,m);}
   return {from,to,currency:'SEK',timezone:'Europe/Stockholm',totals,orders:rows,days:[...periods.values()].sort((a,b)=>a.day.localeCompare(b.day)),methods:[...methods.values()],expenses:expenses.rows.map(r=>({...r,amount:Number(r.amount)})),missingCosts:missing.rows,sync:state.rows.find(r=>r.key==='sync')?.value||{status:'not_started'},settings};
  });
  protectedApp.post('/profit/api/sync',async(_request,reply)=>{void config.sync().catch(()=>{});return reply.code(202).send({ok:true});});
  protectedApp.put('/profit/api/order-cost',async(request,reply)=>{
   const p=z.object({orderId:gid,lineId:gid,cost:amount}).safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Enter a valid purchase cost.'});
   const r=await pool.query(`UPDATE profit_costs SET unit_cost=$3,source='confirmed_manual',recorded_at=now() WHERE order_id=$1 AND line_id=$2 RETURNING order_id`,[p.data.orderId,p.data.lineId,minor(String(p.data.cost))]);
   if(!r.rowCount)return reply.code(404).send({error:'Order item not found'});await audit((request as any).profitActor,'order_cost',p.data);return {ok:true};
  });
  protectedApp.put('/profit/api/variant-cost',async(request,reply)=>{
   const p=z.object({variantId:gid,cost:amount,applyMissing:z.boolean().default(false)}).safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Enter a valid purchase cost.'});
   const v=(await pool.query('SELECT product_id FROM profit_variants WHERE id=$1',[p.data.variantId])).rows[0];if(!v)return reply.code(404).send({error:'Product not found'});
   const d:any=await shopify.query(`mutation($productId:ID!,$variants:[ProductVariantsBulkInput!]!){productVariantsBulkUpdate(productId:$productId,variants:$variants){userErrors{message}}}`,{productId:v.product_id,variants:[{id:p.data.variantId,inventoryItem:{cost:p.data.cost}}]});
   if(d.productVariantsBulkUpdate.userErrors.length)return reply.code(422).send({error:d.productVariantsBulkUpdate.userErrors.map((e:any)=>e.message).join('; ')});
   await pool.query('UPDATE profit_variants SET cost=$2,synced_at=now() WHERE id=$1',[p.data.variantId,minor(String(p.data.cost))]);
   if(p.data.applyMissing)await pool.query(`UPDATE profit_costs SET unit_cost=$2,source='confirmed_manual',recorded_at=now() WHERE variant_id=$1 AND unit_cost IS NULL`,[p.data.variantId,minor(String(p.data.cost))]);
   await audit((request as any).profitActor,'variant_cost',p.data);return {ok:true};
  });
  protectedApp.put('/profit/api/order-expenses',async(request,reply)=>{
   const p=z.object({orderId:gid,shipping:amount.nullable(),packaging:amount.nullable(),fees:amount.nullable(),tax:amount.nullable(),note:z.string().max(1000)}).safeParse(request.body);
   if(!p.success)return reply.code(400).send({error:'Enter valid expense amounts.'});const d=p.data;const n=(v:number|null)=>v==null?null:minor(String(v));
   if(!(await pool.query('SELECT 1 FROM profit_orders WHERE id=$1',[d.orderId])).rowCount)return reply.code(404).send({error:'Order not found'});
   await pool.query(`INSERT INTO profit_adjustments(order_id,shipping_cost,packaging_cost,fee_override,tax_override,note,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(order_id) DO UPDATE SET shipping_cost=$2,packaging_cost=$3,fee_override=$4,tax_override=$5,note=$6,updated_by=$7,updated_at=now()`,[d.orderId,n(d.shipping),n(d.packaging),n(d.fees),n(d.tax),d.note,(request as any).profitActor]);
   await audit((request as any).profitActor,'order_expenses',d);return {ok:true};
  });
  protectedApp.post('/profit/api/expenses',async(request,reply)=>{
   const p=z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),category:z.enum(['Advertising','Shopify & apps','Rent','Payroll','Other']),description:z.string().trim().min(1).max(200),amount:amount.positive()}).safeParse(request.body);
   if(!p.success)return reply.code(400).send({error:'Enter a date, description and amount.'});const d=p.data;
   const r=await pool.query('INSERT INTO profit_expenses(day,category,description,amount,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[d.day,d.category,d.description,minor(String(d.amount)),(request as any).profitActor]);await audit((request as any).profitActor,'expense_added',{...d,id:r.rows[0].id});return {ok:true};
  });
  protectedApp.delete('/profit/api/expenses/:id',async(request,reply)=>{
   const id=(request.params as any).id;if(!z.string().uuid().safeParse(id).success)return reply.code(400).send({error:'Invalid expense'});
   const r=await pool.query('DELETE FROM profit_expenses WHERE id=$1 RETURNING *',[id]);if(!r.rowCount)return reply.code(404).send({error:'Expense not found'});await audit((request as any).profitActor,'expense_removed',r.rows[0]);return {ok:true};
  });
  protectedApp.put('/profit/api/settings',async(request,reply)=>{
   const p=z.object({shippingDefault:amount.nullable(),packagingDefault:amount.nullable(),taxBasis:z.enum(['shopify','unconfirmed'])}).safeParse(request.body);if(!p.success)return reply.code(400).send({error:'Enter valid defaults'});
   const d={...p.data,shippingDefault:p.data.shippingDefault==null?null:minor(String(p.data.shippingDefault)),packagingDefault:p.data.packagingDefault==null?null:minor(String(p.data.packagingDefault))};
   await pool.query(`INSERT INTO profit_state(key,value) VALUES('settings',$1) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=now()`,[JSON.stringify(d)]);await audit((request as any).profitActor,'settings',d);return {ok:true};
  });
 });
}
