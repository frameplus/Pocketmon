window.drawField=function(canvas){
 const c=canvas.getContext('2d'),rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h)},oval=(x,y,a,b,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,a,b,0,0,Math.PI*2);c.fill()};
 let seed=17;const r=()=>((seed=seed*16807%2147483647)/2147483647);
 rect(0,0,480,160,'#a2e0eb');rect(0,32,480,33,'#b9e8eb');rect(0,60,480,30,'#d6eddd');
 for(const [x,y,z] of [[12,12,1],[160,18,.7],[280,8,1.2],[405,24,.8]])for(const [dx,dy,w,h] of [[0,7,50,7],[6,3,17,9],[17,-2,17,14],[29,2,12,11]])rect(x+dx*z,y+dy*z,w*z,h*z,'#fffde2');
 for(const [base,amp,period,col] of [[66,20,35,'#90bfb6'],[76,16,28,'#6fa69b'],[84,10,19,'#548d80']])for(let x=0;x<480;x+=3){let y=base-amp*Math.abs(Math.sin(x/period+.8))-.3*amp*Math.cos(x/23);rect(x,Math.round(y),3,98-y,col)}
 for(let x=-4;x<484;x+=4){let y=71+r()*6;rect(x,y,3,5,'#478362');rect(x-2,y+4,7,8,'#478362')}
 rect(0,84,480,8,'#b5d478');rect(0,92,480,9,'#90bd69');rect(0,101,480,7,'#d7e4a1');rect(0,108,480,52,'#a1c778');
 for(let i=0;i<510;i++)rect(r()*480,90+r()*70,1+r()*5,1,r()>.55?'#c8da87':'#84b269');
 for(const x of [116,364]){oval(x,147,82,11,'#73a45e');oval(x,144,81,10,'#e1e2a1');oval(x,143,76,8,'#9aca79');oval(x,142,59,5,'#acd280')}
 for(const x of [4,43,442,476]){let y=56+r()*10;rect(x,y+10,3,22,'#775f44');for(const [a,b,w,h,col] of [[-8,4,19,17,'#508b63'],[-5,-4,14,16,'#62a16c'],[-2,-10,8,13,'#83b97a']])rect(x+a,y+b,w,h,col)}
};