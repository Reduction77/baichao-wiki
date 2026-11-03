// These colors describe the report's badges, not the weapon artwork/name.
// Keep rarity sampling left of the badge: a gold 5-rank badge can be on a 4-star weapon.
export function hsv(r,g,b){
 r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 const h=!d?0:(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;
 return {h,s:max?d/max:0,v:max};
}
function colors(rgba){const out=[];for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<128)continue;out.push(hsv(rgba[i],rgba[i+1],rgba[i+2]));}return out;}
export function weaponRankFromBadge(rgba){
 const all=colors(rgba),a=all.filter(c=>c.s>.18&&c.v>.18);
 if(a.length<Math.max(3,all.length*.14))return null;
 const group=c=>c.h>=25&&c.h<70?5:c.h>=140&&c.h<185?2:c.h>=185&&c.h<=245?'blue':c.h>=250&&c.h<315?4:null;
 const counts=new Map();for(const c of a){const k=group(c);if(k!==null)counts.set(k,(counts.get(k)||0)+1);}
 const best=[...counts].sort((a,b)=>b[1]-a[1])[0];if(!best||best[1]/a.length<.65)return null;
 const chosen=a.filter(c=>group(c)===best[0]),median=k=>chosen.map(c=>c[k]).sort((a,b)=>a-b)[Math.floor(chosen.length/2)];
 if(best[0]==='blue')return median('v')<.56?1:median('v')>.60&&median('s')>.4?3:null;
 return best[0];
}
