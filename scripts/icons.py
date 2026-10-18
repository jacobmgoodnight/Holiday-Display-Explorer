from PIL import Image,ImageDraw
for size in (192,512):
 im=Image.new('RGB',(size,size),'#174e42');d=ImageDraw.Draw(im);s=size/512
 def line(points):d.line([(int(x*s),int(y*s)) for x,y in points],fill='#f7f3dc',width=max(4,int(22*s)),joint='curve')
 line([(125,265),(256,150),(387,265)]);line([(160,240),(160,375),(352,375),(352,240)]);line([(225,375),(225,282),(287,282),(287,375)])
 d.polygon([(int(x*s),int(y*s)) for x,y in [(360,92),(370,120),(398,130),(370,140),(360,168),(350,140),(322,130),(350,120)]],fill='#e9b77b')
 im.save(f'public/icon-{size}.png')
