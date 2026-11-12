"""
Prints de página inteira dos visuais premium (computador e celular) + checagem de rolagem lateral.
    uv run --no-project --python 3.11 --with playwright==1.55.0 python tests/web/prints_premium.py [visual ...]
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
from teste_enova import BASE, PRINTS, TAMANHOS, entrar, esperar

VISUAIS = sys.argv[1:] or ["maison", "noite", "horizonte"]


def main():
    falhas = []
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        for nome, tam in TAMANHOS.items():
            ctx = nav.new_context(viewport=tam, locale="pt-BR")
            page = ctx.new_page()
            entrar(page)
            for v in VISUAIS:
                page.goto(f"{BASE}/api/vendas/amostra/{v}", timeout=180_000)
                esperar(page, 15_000)
                # rola devagar até o fim para disparar as fotos que se revelam
                altura = page.evaluate("document.body.scrollHeight")
                y = 0
                while y < altura:
                    y += tam["height"] // 2
                    page.evaluate(f"scrollTo(0,{y})")
                    page.wait_for_timeout(120)
                page.wait_for_timeout(1500)
                page.evaluate("scrollTo(0,0)")
                page.wait_for_timeout(2200)
                lateral = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                ocultas = page.evaluate("[...document.querySelectorAll('.foto-rev:not(.on)')].length")
                print(f"{nome} {v}: rolagem lateral={lateral} fotos sem revelar={ocultas}")
                if lateral or ocultas:
                    falhas.append(f"{nome} {v}")
                page.screenshot(path=str(PRINTS / f"premium-{v}-{nome}.png"), full_page=True)
                page.screenshot(path=str(PRINTS / f"premium-{v}-{nome}-topo.png"))
            ctx.close()
        nav.close()
    print("FALHAS:", falhas or "nenhuma")


if __name__ == "__main__":
    main()
