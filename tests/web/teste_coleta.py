"""
Teste da coleta pelos links no "Cadastrar à mão" do Criador de sites (computador e celular).
    uv run --no-project --python 3.11 --with playwright==1.55.0 python tests/web/teste_coleta.py
"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
from teste_enova import BASE, PRINTS, TAMANHOS, entrar, esperar


def main():
    falhas = []
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)
        for nome, tam in TAMANHOS.items():
            ctx = nav.new_context(viewport=tam, locale="pt-BR")
            page = ctx.new_page()
            entrar(page)
            page.goto(f"{BASE}/painel/sites/novo?setor=padaria")
            esperar(page)
            page.get_by_role("tab", name="Cadastrar à mão").click()
            page.get_by_label("WhatsApp", exact=True).fill("https://wa.me/5519998765432")
            page.get_by_label("Google Maps").fill("https://www.google.com/maps/place/Starbucks/@-22.8945,-47.0498,17z")
            page.get_by_label("Site (se tiver)").fill("https://www.starbucks.com.br")
            page.get_by_role("button", name="Buscar dados").click()
            page.get_by_text("Os campos abaixo já foram preenchidos").wait_for(timeout=90_000)
            nomeCampo = page.locator("#c-nome").input_value()
            tel = page.locator("#c-telefone").input_value()
            print(f"{nome}: nome={nomeCampo!r} telefone={tel!r}")
            if not nomeCampo or not tel:
                falhas.append(f"{nome}: campos vazios")
            lateral = page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
            if lateral:
                falhas.append(f"{nome}: rolagem lateral")
            page.screenshot(path=str(PRINTS / f"coleta-{nome}.png"), full_page=True)
            page.locator("#c-cidade").fill("Campinas")
            page.get_by_role("button", name="Usar este negócio").click()
            page.wait_for_timeout(1500)
            page.screenshot(path=str(PRINTS / f"coleta-{nome}-detalhes.png"), full_page=True)
            ctx.close()
        nav.close()
    print("FALHAS:", falhas or "nenhuma")


if __name__ == "__main__":
    main()
