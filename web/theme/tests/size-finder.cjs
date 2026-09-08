const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const context={module:{exports:{}}};vm.runInNewContext(fs.readFileSync('web/theme/assets/cf-size-finder.js','utf8'),context);const {recommend}=context.module.exports;
const p={title:'Moncler Ryan Jacket',category:'Clothing > Outerwear',description:'Size 6 Fits XL',options:['Size'],variants:[{options:['XXL'],available:true}],pit:'60',length:'72'};
const input={height:180,weight:80,reference:'men',fit:'regular',usual:'XL'};
let r=recommend(p,input);assert.match(r.detail,/outside that starting range/);assert.match(r.facts.join(' '),/Fits XL/);
r=recommend(p,{...input,pit:59,length:70});assert.equal(r.heading,'A close width match');assert.match(r.detail,/2 cm longer/);
r=recommend(p,{...input,pit:65});assert.equal(r.heading,'A closer chest fit');
r=recommend({...p,title:'Jeans',category:'Clothing > Pants'},input);assert.equal(r.heading,'Compare waist and inside leg');
r=recommend({...p,title:'Kids jacket'},input);assert.match(r.detail,/adult sizing only/);
r=recommend(p,{...input,height:-1});assert.equal(r.heading,'Check your measurements');
r=recommend(p,{...input,height:210,usual:''});assert.match(r.heading,/measurement comparison/);
r=recommend({...p,variants:[{options:['XXL'],available:false}]},input);assert.match(r.facts.join(' '),/sold out/);
r=recommend({...p,variants:[{options:['M'],available:true},{options:['L'],available:true}]},{...input,pit:60});assert.notEqual(r.heading,'A close width match');assert.doesNotMatch(r.facts.join(' '),/Fits XL/);
r=recommend({...p,description:'',variants:[{options:['50'],available:true}]},input);assert.match(r.detail,/Numeric sizes are not converted/);
r=recommend({...p,pit:'',chest:'120'},{...input,pit:60});assert.equal(r.heading,'A close width match');
r=recommend(p,{...input,usual:''});assert.match(r.heading,/Rough starting range/);
// The reported usual size cannot control the independent estimate.
const baseline=recommend(p,{...input,usual:''});
for(const usual of ['XXS','S','M','XL','3XL']) {
  assert.equal(recommend(p,{...input,usual}).heading,baseline.heading);
}
assert.match(recommend(p,{...input,usual:'3XL'}).facts.join(' '),/differs from this rough range/);
assert.match(recommend(p,{...input,usual:'M'}).facts.join(' '),/only as a cross-check/);
assert.notEqual(recommend(p,{...input,weight:55}).heading,recommend(p,{...input,weight:115}).heading);
assert.notEqual(recommend(p,{...input,height:150}).heading,recommend(p,{...input,height:200}).heading);
assert.match(recommend(p,{...input,height:210,usual:'M'}).heading,/measurement comparison/);
assert.equal(recommend(p,{...input,pit:59,usual:'XXS'}).heading,recommend(p,{...input,pit:59,usual:'3XL'}).heading);
assert.notEqual(recommend(p,{...input,pit:50}).heading,recommend(p,{...input,pit:70}).heading);
console.log('Fit regressions passed, including usual-size independence, body inputs, and actual garment comparisons');
