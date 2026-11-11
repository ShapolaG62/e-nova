// Cria o primeiro sócio (SUPER_ADMIN) e, com --demo, dados de exemplo.
// Uso: npm run db:seed            → só o admin (lê SEED_ADMIN_* do .env.local)
//      npm run db:seed -- --demo  → admin + 3 clientes, plaquinhas e toques fictícios
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import * as t from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

const db = createDb(process.env.DATABASE_URL);

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env.local");

  const existing = await db.query.users.findFirst({ where: sql`lower(${t.users.email}) = ${email}` });
  if (!existing) {
    await db.insert(t.users).values({
      name: process.env.SEED_ADMIN_NAME ?? "Sócio",
      email,
      role: "SUPER_ADMIN",
      passwordHash: await hashPassword(password),
    });
    console.log(`✓ Sócio criado: ${email}`);
  } else {
    console.log(`• Sócio já existe: ${email}`);
  }

  if (process.argv.includes("--demo")) {
    await demo();
    await demoModules();
  }
  process.exit(0);
}

/** Dados de exemplo dos módulos 2–5 (avaliações, sites, contratos antigos). Idempotente. */
async function demoModules() {
  const clients = await db.select().from(t.clients);
  const nona = clients.find((c) => c.tradeName === "Cantina da Nona");
  const navalha = clients.find((c) => c.tradeName === "Barbearia Navalha");
  if (!nona || !navalha) return;

  const [{ reviews }] = await db.select({ reviews: sql<number>`count(*)::int` }).from(t.reviews);
  if (reviews === 0) {
    const day = 86_400_000;
    await db.insert(t.reviews).values([
      { clientId: nona.id, authorName: "Mariana Souza", rating: 5, text: "Massa fresca maravilhosa e atendimento super atencioso. A lasanha da casa é a melhor que já comi!", reviewedAt: new Date(Date.now() - 2 * day) },
      { clientId: nona.id, authorName: "Ricardo Lima", rating: 2, text: "Comida boa, mas esperamos quase 50 minutos pelo prato num sábado. Faltou avisar da demora.", reviewedAt: new Date(Date.now() - 4 * day) },
      { clientId: nona.id, authorName: "Ana P.", rating: 4, text: "Ambiente aconchegante, preço justo. Só achei a música um pouco alta.", reviewedAt: new Date(Date.now() - 9 * day) },
      { clientId: navalha.id, authorName: "João Pedro", rating: 5, text: "Corte impecável e o barbeiro manja muito de barba. Voltarei!", reviewedAt: new Date(Date.now() - 1 * day) },
      { clientId: navalha.id, authorName: null, rating: 3, text: null, reviewedAt: new Date(Date.now() - 6 * day) },
    ]);
    await db.update(t.clients).set({ reviewTags: ["Massa fresca", "Atendimento atencioso", "Ambiente aconchegante", "Preço justo", "Porções generosas"], brandVoice: "Acolhedor, de família italiana, trata o cliente pelo nome" }).where(sql`${t.clients.id} = ${nona.id}`);
    console.log("✓ Demo: avaliações");
  }

  const [{ monitors }] = await db.select({ monitors: sql<number>`count(*)::int` }).from(t.monitors);
  if (monitors === 0) {
    await db.insert(t.monitors).values([
      { name: "Site da Cantina (exemplo)", url: "https://example.com", clientId: nona.id, intervalMinutes: 5 },
      { name: "Landing da Barbearia (exemplo)", url: "https://www.iana.org/help/example-domains", clientId: navalha.id, intervalMinutes: 15 },
      { name: "Site fora do ar (teste)", url: "https://enova-site-que-nao-existe.invalid", clientId: navalha.id, intervalMinutes: 5 },
    ]);
    console.log("✓ Demo: sites monitorados");
  }

  // Contratos com datas passadas para o gráfico de MRR do BI
  const [{ old }] = await db.select({ old: sql<number>`count(*)::int` }).from(t.contracts).where(sql`${t.contracts.startsAt} < now() - interval '60 days'`);
  if (old === 0) {
    const monthsAgo = (n: number) => new Date(Date.now() - n * 30 * 86_400_000);
    await db.insert(t.contracts).values([
      { clientId: navalha.id, type: "RECURRING", service: "Manutenção Web", amountCents: 19900, startsAt: monthsAgo(8) },
      { clientId: nona.id, type: "ONE_OFF", service: "Criação de Site", amountCents: 250000, startsAt: monthsAgo(5) },
      { clientId: navalha.id, type: "RECURRING", service: "Gestão de Redes", amountCents: 69000, startsAt: monthsAgo(6), status: "CANCELED", endedAt: monthsAgo(2) },
    ]);
    await db.execute(sql`update contracts set starts_at = now() - interval '10 months' where service = 'Aluguel de Plaquinhas'`);
    console.log("✓ Demo: histórico de contratos");
  }
}

async function demo() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.clients);
  if (n > 0) return console.log("• Já há clientes; pulando dados de demonstração.");

  const day = 86_400_000;
  const clients = await db
    .insert(t.clients)
    .values([
      { legalName: "Cantina da Nona LTDA", tradeName: "Cantina da Nona", niche: "Restaurante", status: "ACTIVE", googlePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4", contactName: "Rosa" },
      { legalName: "Barbearia Navalha ME", tradeName: "Barbearia Navalha", niche: "Barbearia", status: "TRIAL", trialEndsAt: new Date(Date.now() + 9 * day), googlePlaceId: "ChIJ2eUgeAK6j4ARbn5u_wAGqWA" },
      { legalName: "Clínica Sorriso SS", tradeName: "Clínica Sorriso", niche: "Odontologia", status: "SUSPENDED_PAYMENT", googlePlaceId: "ChIJOwg_06VPwokRYv534QaPC8g" },
    ])
    .returning();

  await db.insert(t.contracts).values([
    { clientId: clients[0].id, type: "RECURRING", service: "Aluguel de Plaquinhas", amountCents: 14990 },
    { clientId: clients[0].id, type: "RECURRING", service: "Gestão de Redes", amountCents: 89000 },
    { clientId: clients[0].id, type: "ONE_OFF", service: "Setup de Placas", amountCents: 30000 },
    { clientId: clients[2].id, type: "RECURRING", service: "Aluguel de Plaquinhas", amountCents: 14990 },
  ]);

  const plates = await db
    .insert(t.plates)
    .values([
      { clientId: clients[0].id, slug: "cantina-nona-balcao", label: "Balcão" },
      { clientId: clients[0].id, slug: "cantina-nona-mesa-4", label: "Mesa 4", kind: "NFC" },
      { clientId: clients[1].id, slug: "navalha-espelho", label: "Espelho 1" },
      { clientId: clients[2].id, slug: "sorriso-recepcao", label: "Recepção", kind: "QR" },
    ])
    .returning();

  const devices = ["IOS", "IOS", "ANDROID", "ANDROID", "ANDROID", "DESKTOP"] as const;
  const cities = [["São Paulo", "SP"], ["Campinas", "SP"], ["Santo André", "SP"]] as const;
  const taps: (typeof t.plateTaps.$inferInsert)[] = [];
  for (const p of plates) {
    const client = clients.find((c) => c.id === p.clientId)!;
    for (let i = 0; i < 30; i++) {
      const perDay = Math.floor(Math.random() * (p.slug.includes("balcao") ? 9 : 4));
      for (let k = 0; k < perDay; k++) {
        const device = devices[Math.floor(Math.random() * devices.length)];
        const [city, region] = cities[Math.floor(Math.random() * cities.length)];
        taps.push({
          plateId: p.id,
          clientId: p.clientId,
          occurredAt: new Date(Date.now() - i * day - Math.random() * day),
          outcome: client.status === "SUSPENDED_PAYMENT" ? "SUSPENDED" : "REDIRECT_REVIEW",
          device,
          os: device === "IOS" ? "iOS" : device === "ANDROID" ? "Android" : "Windows",
          browser: device === "IOS" ? "Mobile Safari" : "Chrome",
          country: "BR",
          region,
          city,
        });
      }
    }
  }
  if (taps.length) await db.insert(t.plateTaps).values(taps);
  console.log(`✓ Demo: ${clients.length} clientes, ${plates.length} plaquinhas, ${taps.length} toques`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
