"""
Testes de tela do E-Nova (skill webapp-testing, Playwright em Python).

Como rodar (com o site já ligado em http://localhost:3100):
    uv run --no-project --python 3.11 --with playwright==1.55.0 python tests/web/teste_enova.py

O login usa o usuário de teste do .env.local (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) — nunca uma conta real.
Os prints ficam em tests/web/prints/ (fora do git).
"""
import os
import re
import sys
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("ENOVA_URL", "http://localhost:3100")
RAIZ = Path(__file__).resolve().parents[2]
PRINTS = Path(__file__).parent / "prints"
PRINTS.mkdir(exist_ok=True)

TELAS = ["/painel", "/painel/gerador", "/painel/clipador", "/painel/visuais", "/painel/sites", "/painel/vozes"]
VISUAIS = ["maison", "noite", "horizonte", "aurora", "brasa", "chave", "clinica", "lex", "oficio", "patas", "sabor", "serena", "vitrine", "atelier", "pulso"]
PALETAS = ["oceano-profundo", "por-do-sol", "copa-da-floresta", "minimalista", "hora-dourada", "gelo-artico", "rosa-do-deserto", "inovacao", "jardim-botanico", "galaxia"]
TAMANHOS = {"computador": {"width": 1366, "height": 860}, "celular": {"width": 375, "height": 812}}

falhas: list[str] = []


def ok(cond: bool, msg: str):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


def credenciais():
    texto = (RAIZ / ".env.local").read_text(encoding="utf-8")
    pega = lambda k: re.search(rf"^{k}=(.*)$", texto, re.M).group(1).strip().strip('"')
    return pega("SEED_ADMIN_EMAIL"), pega("SEED_ADMIN_PASSWORD")


def esperar(page, ms=10_000):
    """Espera a rede parar; telas com miniaturas de sites (fotos externas) nunca param de vez, então segue depois do limite."""
    try:
        page.wait_for_load_state("networkidle", timeout=ms)
    except Exception:
        page.wait_for_timeout(1500)


def entrar(page):
    email, senha = credenciais()
    page.goto(f"{BASE}/login")
    esperar(page)
    page.get_by_label("E-mail ou usuário").fill(email)
    page.get_by_label("Senha").fill(senha)
    page.get_by_role("button", name="Entrar").click()
    page.wait_for_url(re.compile(r"/painel"), timeout=30_000)


def main():
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True)

        for nome, tam in TAMANHOS.items():
            print(f"\n== Telas no {nome} ({tam['width']}px)")
            ctx = nav.new_context(viewport=tam, locale="pt-BR")
            page = ctx.new_page()
            erros: list[str] = []
            page.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: erros.append(str(e)))
            entrar(page)
            for tela in TELAS:
                erros.clear()
                r = page.goto(f"{BASE}{tela}")
                esperar(page)
                ok(r is not None and r.ok, f"{tela} abre (HTTP {r.status if r else '?'})")
                ok(page.locator("h1").count() > 0, f"{tela} tem título")
                larg = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
                ok(larg[0] <= larg[1] + 1, f"{tela} sem rolagem lateral ({larg[0]}px de {larg[1]}px)")
                # erros de hidratação/JS quebram a tela; avisos de recurso externo (fotos de exemplo) não contam
                graves = [e for e in erros if re.search(r"Hydration|TypeError|ReferenceError|Unhandled", e)]
                ok(not graves, f"{tela} sem erros de JavaScript" + (f": {graves[0][:120]}" if graves else ""))
                page.screenshot(path=str(PRINTS / f"{nome}{tela.replace('/', '_')}.png"), full_page=False)
            ctx.close()

        print("\n== Amostras dos visuais e das paletas")
        ctx = nav.new_context(viewport=TAMANHOS["celular"])
        page = ctx.new_page()
        entrar(page)
        for v in VISUAIS:
            r = page.goto(f"{BASE}/api/vendas/amostra/{v}", wait_until="domcontentloaded")
            classe = page.evaluate("() => document.body.className")
            ok(r.ok and f"lay-{v}" in classe, f"visual {v} renderiza")
            larg = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
            ok(larg[0] <= larg[1] + 1, f"visual {v} cabe no celular ({larg[0]}px)")
        for pal in PALETAS:
            r = page.goto(f"{BASE}/api/vendas/amostra/pulso?paleta={pal}", wait_until="domcontentloaded")
            html = page.content()
            ok(r.ok and "tema-" in page.evaluate("() => document.body.className"), f"paleta {pal} renderiza")
        page.goto(f"{BASE}/api/vendas/amostra/atelier?paleta=galaxia", wait_until="domcontentloaded")
        page.screenshot(path=str(PRINTS / "amostra_atelier_galaxia.png"), full_page=True)
        page.goto(f"{BASE}/api/vendas/amostra/vitrine", wait_until="domcontentloaded")
        page.screenshot(path=str(PRINTS / "amostra_vitrine.png"), full_page=True)

        print("\n== Editor de site: paletas prontas")
        page.goto(f"{BASE}/painel/sites")
        esperar(page)
        links = page.locator("a[href*='/editor']")
        if links.count() == 0:
            print("  (sem site criado para abrir o editor; pulei)")
        else:
            page.goto(BASE + links.first.get_attribute("href"))
            esperar(page)
            sec = page.get_by_text("Paletas prontas")
            ok(sec.count() > 0, "editor mostra a seção Paletas prontas")
            botao = page.get_by_role("button", name=re.compile("Galáxia"))
            if botao.count():
                botao.first.click()
                ok(botao.first.get_attribute("aria-pressed") == "true", "clicar na paleta Galáxia marca a escolha")
            page.screenshot(path=str(PRINTS / "editor_paletas.png"))
        ctx.close()
        nav.close()

    print(f"\n{'TUDO CERTO' if not falhas else f'{len(falhas)} FALHA(S)'}")
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    main()
