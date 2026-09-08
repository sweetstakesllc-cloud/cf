import type pg from 'pg';
import type {ShopifyAdminClient} from '../certificates/shopify.js';
import {minor,type ProfitOrder,type ProfitLine} from './model.js';
const bag='{shopMoney{amount currencyCode}}';
const page='pageInfo{hasNextPage endCursor}';
const line=`id title sku quantity currentQuantity isGiftCard requiresShipping discountedUnitPriceAfterAllDiscountsSet${bag} product{id} variant{id inventoryItem{id unitCost{amount currencyCode}}}`;
const refundLine='quantity restocked restockType lineItem{id}';
const fields=`id name processedAt updatedAt test displayFinancialStatus displayFulfillmentStatus netPaymentSet${bag} currentTotalPriceSet${bag} currentTotalTaxSet${bag} currentShippingPriceSet${bag} totalRefundedSet${bag}
 lineItems(first:30){nodes{${line}} ${page}}
 transactions(first:100){id kind status gateway formattedGateway test amountSet${bag} paymentDetails{...on CardPaymentDetails{wallet paymentMethodName} ...on LocalPaymentMethodsPaymentDetails{paymentMethodName} ...on PaypalWalletPaymentDetails{paymentMethodName} ...on ShopPayInstallmentsPaymentDetails{paymentMethodName}} fees{id type amount{amount currencyCode} taxAmount{amount currencyCode}}}
 refunds{ id refundLineItems(first:30){nodes{${refundLine}} ${page}} }`;
export async function syncProfit(pool:pg.Pool,shopify:ShopifyAdminClient):Promise<boolean>{
 const lock=await pool.connect();const acquired=(await lock.query("SELECT pg_try_advisory_lock(71442026) AS locked")).rows[0].locked;
 if(!acquired){lock.release();return false;}
 const started=new Date().toISOString();
 try{
  await pool.query(`INSERT INTO profit_state(key,value) VALUES('sync',$1) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=now()`,[JSON.stringify({status:'syncing',started})]);
  const info=await shopify.query<{shop:{currencyCode:string;ianaTimezone:string};currentAppInstallation:{accessScopes:{handle:string}[]}}>('{shop{currencyCode ianaTimezone} currentAppInstallation{accessScopes{handle}}}');
  if(info.shop.currencyCode!=='SEK'||info.shop.ianaTimezone!=='Europe/Stockholm')throw Error('Store currency/timezone requires configuration');
  const allHistory=info.currentAppInstallation.accessScopes.some(s=>s.handle==='read_all_orders');
  const since=allHistory?'1970-01-01T00:00:00Z':new Date(Date.now()-59*86400000).toISOString();let cursor:string|null=null;let orders=0;
  do{
   const d:{orders:{nodes:ProfitOrder[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}}=await shopify.query(`query($cursor:String,$query:String!){orders(first:12,after:$cursor,query:$query,sortKey:CREATED_AT){nodes{${fields}} ${page}}}`,{cursor,query:`created_at:>=${since}`});
   for(const order of d.orders.nodes){
    while(order.lineItems.pageInfo.hasNextPage){
     const extra:{order:{lineItems:{nodes:ProfitLine[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}}}=await shopify.query(`query($id:ID!,$cursor:String){order(id:$id){lineItems(first:100,after:$cursor){nodes{${line}} ${page}}}}`,{id:order.id,cursor:order.lineItems.pageInfo.endCursor});
     if(extra.order.lineItems.pageInfo.hasNextPage&&extra.order.lineItems.pageInfo.endCursor===order.lineItems.pageInfo.endCursor)throw Error('Line pagination stalled');
     order.lineItems.nodes.push(...extra.order.lineItems.nodes);order.lineItems.pageInfo=extra.order.lineItems.pageInfo;
    }
    for(const refund of order.refunds)while(refund.refundLineItems.pageInfo.hasNextPage){
     const extra:{refund:ProfitOrder['refunds'][number]}=await shopify.query(`query($id:ID!,$cursor:String){refund(id:$id){refundLineItems(first:100,after:$cursor){nodes{${refundLine}} ${page}}}}`,{id:refund.id,cursor:refund.refundLineItems.pageInfo.endCursor});
     if(extra.refund.refundLineItems.pageInfo.hasNextPage&&extra.refund.refundLineItems.pageInfo.endCursor===refund.refundLineItems.pageInfo.endCursor)throw Error('Refund pagination stalled');
     refund.refundLineItems.nodes.push(...extra.refund.refundLineItems.nodes);refund.refundLineItems.pageInfo=extra.refund.refundLineItems.pageInfo;
    }
    // Shopify caps order transactions at 100. Do not silently treat a truncated ledger as complete.
    if(order.transactions.length>=100)throw Error('Order exceeds transaction window; review required');
    await lock.query('BEGIN');
    try{
     await lock.query(`INSERT INTO profit_orders(id,name,processed_at,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=$2,processed_at=$3,data=$4,synced_at=now()`,[order.id,order.name,order.processedAt,JSON.stringify(order)]);
     for(const item of order.lineItems.nodes){const cost=item.variant?.inventoryItem.unitCost;
      await lock.query(`INSERT INTO profit_costs(order_id,line_id,variant_id,unit_cost,source) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_id,line_id) DO NOTHING`,[order.id,item.id,item.variant?.id||null,cost?.currencyCode==='SEK'?minor(cost.amount):null,cost?'current_cost_on_import':'missing']);}
     await lock.query('COMMIT');
    }catch(e){await lock.query('ROLLBACK');throw e;}
    orders++;
   }
   if(d.orders.pageInfo.hasNextPage&&d.orders.pageInfo.endCursor===cursor)throw Error('Order pagination stalled');
   cursor=d.orders.pageInfo.hasNextPage?d.orders.pageInfo.endCursor:null;
  }while(cursor);
  cursor=null;let variants=0;
  do{
   const d:any=await shopify.query(`query($cursor:String){productVariants(first:150,after:$cursor){nodes{id title sku inventoryQuantity product{id title status} inventoryItem{id unitCost{amount currencyCode}}} ${page}}}`,{cursor});
   for(const v of d.productVariants.nodes){const cost=v.inventoryItem.unitCost;
    await pool.query(`INSERT INTO profit_variants(id,product_id,inventory_id,title,sku,cost,quantity,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(id) DO UPDATE SET product_id=$2,inventory_id=$3,title=$4,sku=$5,cost=$6,quantity=$7,active=$8,synced_at=now()`,[v.id,v.product.id,v.inventoryItem.id,v.product.title+(v.title==='Default Title'?'':` — ${v.title}`),v.sku,cost?.currencyCode==='SEK'?minor(cost.amount):null,v.inventoryQuantity||0,v.product.status==='ACTIVE']);variants++;}
   if(d.productVariants.pageInfo.hasNextPage&&d.productVariants.pageInfo.endCursor===cursor)throw Error('Variant pagination stalled');
   cursor=d.productVariants.pageInfo.hasNextPage?d.productVariants.pageInfo.endCursor:null;
  }while(cursor);
  await pool.query('UPDATE profit_variants SET active=false WHERE synced_at<$1',[started]);
  const earliest=(await pool.query('SELECT min(processed_at) AS first FROM profit_orders')).rows[0]?.first;
  await pool.query(`INSERT INTO profit_state(key,value) VALUES('sync',$1) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=now()`,[JSON.stringify({status:'ready',started,completed:new Date().toISOString(),orders,variants,historyFrom:earliest?new Date(earliest).toISOString():since,readWindowFrom:since,allHistoryAccess:allHistory})]);
  return true;
 }catch(e){await pool.query(`INSERT INTO profit_state(key,value) VALUES('sync',$1) ON CONFLICT(key) DO UPDATE SET value=$1,updated_at=now()`,[JSON.stringify({status:'error',started,message:e instanceof Error?e.message.slice(0,350):'Sync failed'})]);throw e;}
 finally{await lock.query('SELECT pg_advisory_unlock(71442026)');lock.release();}
}
