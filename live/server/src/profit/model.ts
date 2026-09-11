export type Money={amount:string;currencyCode:string};
export type Bag={shopMoney:Money};
export type ProfitLine={id:string;title:string;quantity:number;currentQuantity:number;sku:string|null;isGiftCard:boolean;requiresShipping:boolean;
 discountedUnitPriceAfterAllDiscountsSet:Bag;variant:null|{id:string;inventoryItem:{id:string;unitCost:Money|null}};product:null|{id:string}};
export type ProfitTransaction={id:string;kind:string;status:string;gateway:string;formattedGateway:string|null;test:boolean;amountSet:Bag;
 paymentDetails:null|{paymentMethodName?:string;wallet?:string|null};fees:Array<{id:string;amount:Money;taxAmount:Money;type:string}>};
export type ProfitOrder={id:string;name:string;processedAt:string;updatedAt:string;test:boolean;displayFinancialStatus:string;displayFulfillmentStatus:string;
 netPaymentSet:Bag;currentTotalPriceSet:Bag;currentTotalTaxSet:Bag;currentShippingPriceSet:Bag;totalRefundedSet:Bag;
 lineItems:{nodes:ProfitLine[];pageInfo:{hasNextPage:boolean;endCursor:string|null}};
 transactions:ProfitTransaction[];refunds:Array<{id:string;refundLineItems:{nodes:Array<{quantity:number;restocked:boolean;restockType:string;lineItem:{id:string}}>;
 pageInfo:{hasNextPage:boolean;endCursor:string|null}}}>};
export type Cost={line_id:string;variant_id:string|null;unit_cost:string|number|null;source:string};
export type Adjustments={shipping_cost:string|number|null;packaging_cost:string|number|null;fee_override:string|number|null;tax_override:string|number|null;note?:string};
export function minor(value:string):number{
 if(!/^-?\d+(\.\d+)?$/.test(value))throw Error('Invalid money');
 const negative=value.startsWith('-');const [whole,fraction='']=value.replace(/^-/, '').split('.') as [string,string?];
 const digits=fraction.padEnd(3,'0');const absolute=BigInt(whole)*100n+BigInt(digits.slice(0,2))+(Number(digits[2])>=5?1n:0n);
 if(absolute>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Money out of range');return Number(absolute)*(negative?-1:1);
}
export function money(bag:Bag):number{if(bag.shopMoney.currencyCode!=='SEK')throw Error('Unsupported shop currency');return minor(bag.shopMoney.amount);}
export function localDay(iso:string):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
export function calculateOrder(order:ProfitOrder,costs:Cost[],adjustment?:Adjustments){
 const issues:string[]=[];const notes:string[]=[];
 const eligible=!order.test&&['PAID','PARTIALLY_REFUNDED','REFUNDED'].includes(order.displayFinancialStatus);
 const revenue=money(order.netPaymentSet);let tax=adjustment?.tax_override==null?money(order.currentTotalTaxSet):Number(adjustment.tax_override);
 if(adjustment?.tax_override==null&&Math.abs(revenue-money(order.currentTotalPriceSet))>1)issues.push('Review tax after payment adjustments');
 const noRestock=new Map<string,number>();
 for(const refund of order.refunds)for(const item of refund.refundLineItems.nodes)if(!item.restocked&&item.restockType==='NO_RESTOCK')noRestock.set(item.lineItem.id,(noRestock.get(item.lineItem.id)||0)+item.quantity);
 let cogs=0;let missingCost=0;let historicalCosts=0;
 const lines=order.lineItems.nodes.map(line=>{
  const units=Math.min(line.quantity,line.currentQuantity+(noRestock.get(line.id)||0));
  const snapshot=costs.find(c=>c.line_id===line.id);const cost=snapshot?.unit_cost==null?null:Number(snapshot.unit_cost);
  if(units>0&&cost==null){missingCost++;issues.push('Missing item cost');}
  if(units>0&&snapshot?.source==='current_cost_on_import'){historicalCosts++;}
  if(line.isGiftCard)issues.push('Gift card accounting needs review');
  const total=cost==null?null:cost*units;cogs+=total||0;
  return {id:line.id,title:line.title,variantId:line.variant?.id||null,productId:line.product?.id||null,units,unitCost:cost,cost:total,source:snapshot?.source||'missing',salesWeight:Math.max(0,money(line.discountedUnitPriceAfterAllDiscountsSet)*line.currentQuantity)};
 });
 const seen=new Set<string>();let fees=0;let missingFees=false;const methods=new Set<string>();
 for(const tx of order.transactions){
  if(tx.test||tx.status!=='SUCCESS')continue;
  const charged=['SALE','CAPTURE'].includes(tx.kind)&&money(tx.amountSet)>0;
  if(charged){methods.add(tx.paymentDetails?.wallet||tx.paymentDetails?.paymentMethodName||tx.formattedGateway||tx.gateway);if(!tx.fees.length)missingFees=true;}
  for(const fee of tx.fees){if(seen.has(fee.id))continue;seen.add(fee.id);if(fee.amount.currencyCode!=='SEK'||fee.taxAmount.currencyCode!=='SEK'){missingFees=true;continue;}fees+=minor(fee.amount.amount)+minor(fee.taxAmount.amount);if(minor(fee.taxAmount.amount)!==0)issues.push('Review recoverable VAT on payment fees');}
 }
 if(adjustment?.fee_override!=null){fees=Number(adjustment.fee_override);missingFees=false;}
 if(missingFees)issues.push('Payment fees need confirmation');
 const shippingRequired=order.lineItems.nodes.some(l=>l.requiresShipping)&&order.displayFulfillmentStatus!=='UNFULFILLED';
 const shipping=adjustment?.shipping_cost==null?null:Number(adjustment.shipping_cost);
 const packaging=adjustment?.packaging_cost==null?null:Number(adjustment.packaging_cost);
 if(shipping==null&&shippingRequired)issues.push('Missing shipping expense');
 if(packaging==null&&shippingRequired)issues.push('Missing packaging expense');
 if(order.displayFulfillmentStatus==='UNFULFILLED')notes.push('Awaiting fulfillment; delivery costs may still change');
 if(historicalCosts)notes.push('Historical purchase costs use the first imported Shopify cost');
 const profit=revenue-tax-cogs-fees-(shipping||0)-(packaging||0);
 const netSales=revenue-tax;const denominator=lines.reduce((sum,l)=>sum+l.salesWeight,0);
 return {id:order.id,name:order.name,day:localDay(order.processedAt),status:order.displayFinancialStatus,fulfillment:order.displayFulfillmentStatus,eligible,revenue,tax,netSales,cogs,fees,shipping,packaging,
  profit:missingCost||missingFees?null:profit,profitBeforeVat:missingCost||missingFees?null:profit+tax,knownCostsBeforeVat:profit+tax,knownCostsResult:profit,complete:issues.length===0&&historicalCosts===0&&order.displayFulfillmentStatus!=='UNFULFILLED',issues:[...new Set(issues)],notes,missingCost,missingFees,historicalCosts,
  methods:[...methods],refunds:money(order.totalRefundedSet),lines:lines.map(l=>({...l,allocatedNetSales:denominator?Math.round(netSales*l.salesWeight/denominator):0}))};
}
