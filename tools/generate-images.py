"""Gera icons/ e store/ (ícone, promo 440x280, marquee 1400x560).

Rodar da raiz do projeto:  python tools/gerar-imagens.py   (precisa de Pillow)

Usa fontes Lora/Poppins/DejaVu nos caminhos de um Linux. Em outro sistema,
troque os caminhos de ImageFont.truetype(...) por fontes instaladas localmente.
O ícone de 128px sai com 96px de arte + 16px de borda transparente — exigência
da Chrome Web Store.
"""
from PIL import Image, ImageDraw, ImageFont

BURGUNDY=(110,31,38,255); CREAM=(251,248,239,255); PARCH=(244,238,221,255)
BRASS=(180,137,46,255); INK_SOFT=(88,80,63,255)
S=1024

def glyph(size=S):
    img=Image.new("RGBA",(size,size),(0,0,0,0)); d=ImageDraw.Draw(img)
    d.rounded_rectangle([0,0,size-1,size-1], radius=int(size*0.22), fill=BURGUNDY)
    cx=cy=size//2; arm=int(size*0.26); t=int(size*0.115)
    d.rounded_rectangle([cx-arm, cy-t//2, cx+arm, cy+t//2], radius=t//2, fill=CREAM)
    d.rounded_rectangle([cx-t//2, cy-arm, cx+t//2, cy+arm], radius=t//2, fill=CREAM)
    return img

art=glyph()
for size in (16,48):
    art.resize((size,size), Image.LANCZOS).save(f"icons/icon{size}.png")
icon128=Image.new("RGBA",(128,128),(0,0,0,0))
icon128.paste(art.resize((96,96), Image.LANCZOS),(16,16))
icon128.save("icons/icon128.png")

tile=Image.new("RGB",(440,280),PARCH[:3]); td=ImageDraw.Draw(tile)
logo=art.resize((104,104),Image.LANCZOS); tile.paste(logo,(40,56),logo)
serif=ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf",36)
mono=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",11)
sans=ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf",15)
td.text((174,60),"EAA+",font=serif,fill=BURGUNDY[:3])
td.text((176,110),"ESCOLA DE ADORAÇÃO E ARTE",font=mono,fill=BRASS[:3])
td.text((174,144),"Melhorias de usabilidade",font=sans,fill=INK_SOFT[:3])
td.text((174,166),"nas páginas da escola.",font=sans,fill=INK_SOFT[:3])
tile.save("store/promo-440x280.png")
print("ok")

# Marquee 1400x560 (opcional na loja, ajuda a ser destacado)
mq=Image.new("RGB",(1400,560),PARCH[:3]); md=ImageDraw.Draw(mq)
md.rectangle([0,0,1400,8], fill=BURGUNDY[:3])
logo=art.resize((240,240),Image.LANCZOS); mq.paste(logo,(150,160),logo)
serif_g=ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf",84)
mono_g=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",20)
sans_g=ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf",28)
md.text((470,170),"EAA+",font=serif_g,fill=BURGUNDY[:3])
md.text((476,285),"ESCOLA DE ADORAÇÃO E ARTE · FABAT",font=mono_g,fill=BRASS[:3])
md.text((472,340),"Filtro por período e destaque",font=sans_g,fill=INK_SOFT[:3])
md.text((472,382),"da próxima aula.",font=sans_g,fill=INK_SOFT[:3])
mq.save("store/marquee-1400x560.png")
print("marquee ok")
