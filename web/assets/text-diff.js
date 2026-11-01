// Tokenize numbers and English words together; Chinese text is compared by character.
// Bound the LCS matrix so unexpectedly large descriptions cannot freeze the page.
export function textDiff(before,after){
 const tokenize=s=>String(s).match(/\d+(?:\.\d+)?%?|[A-Za-z]+(?:['’-][A-Za-z]+)*|\s+|[\s\S]/gu)||[];
 const a=tokenize(before),b=tokenize(after),out=[];
 const push=(type,text)=>{if(!text)return;const last=out.at(-1);if(last?.type===type)last.text+=text;else out.push({type,text});};
 let start=0,endA=a.length,endB=b.length;
 while(start<endA&&start<endB&&a[start]===b[start])start++;
 while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
 push('equal',a.slice(0,start).join(''));
 const m=endA-start,n=endB-start;
 if((m+1)*(n+1)>4000000){push('remove',a.slice(start,endA).join(''));push('add',b.slice(start,endB).join(''));}
 else{
  const width=n+1,table=new Uint32Array((m+1)*width);
  for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)table[i*width+j]=a[start+i]===b[start+j]?1+table[(i+1)*width+j+1]:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
  let i=0,j=0;
  while(i<m||j<n){
   if(i<m&&j<n&&a[start+i]===b[start+j]){push('equal',a[start+i]);i++;j++;}
   else if(i<m&&(j===n||table[(i+1)*width+j]>=table[i*width+j+1])){push('remove',a[start+i++]);}
   else push('add',b[start+j++]);
  }
 }
 push('equal',a.slice(endA).join(''));return out;
}
