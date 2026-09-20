const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const agency = await prisma.agency.findFirst();
  if (!agency) {
    console.error("No agency found");
    return;
  }

  const updatedAgency = await prisma.agency.update({
    where: { id: agency.id },
    data: {
      name: "Adpowers Digital",
      tagline: "On transforme votre budget en croissance",
      website: "https://adpowersdigital.netlify.app",
      phone: "+213 779 41 12 91",
      email: "contact@adpowersdigital.com",
      primaryColor: "#2563eb",
      secondaryColor: "#0f172a",
      currency: "DZD",
      onboarded: true
    }
  });
  console.log("Updated agency:", updatedAgency.name);

  // Default core services for Adpowers Digital
  const defaultServices = [
    {
      name: "Meta Ads Media Buying (Acquisition & Scaling)",
      description: "Gestion stratégique des campagnes Facebook & Instagram Ads. Ciblage chirurgical, angles marketing, tracking Pixel/CAPI et optimisation du ROAS.",
      basePrice: 55000,
      salePrice: 65000,
      type: "MARKETING"
    },
    {
      name: "Création de Site Web & Tunnels E-commerce",
      description: "Conception et développement de boutique e-commerce ou landing page à haute conversion. Design moderne, responsive mobile et intégration des formulaires de commande.",
      basePrice: 40000,
      salePrice: 50000,
      type: "WEBSITE"
    },
    {
      name: "Montage Vidéo & Motion Design Publicitaire",
      description: "Production et montage de vidéos publicitaires percutantes (formats 9:16 pour TikTok/Reels). Hooks captivants, sous-titres animés et sound design.",
      basePrice: 15000,
      salePrice: 20000,
      type: "VIDEO"
    },
    {
      name: "Voice Off Professionnelle",
      description: "Enregistrement studio de voix off professionnelle pour spots publicitaires, vidéos de vente et narration de marque.",
      basePrice: 10000,
      salePrice: 15000,
      type: "AUDIO"
    },
    {
      name: "Testili Product (Validation E-commerce)",
      description: "Testing approfondi de vos produits e-commerce. Validation des produits gagnants (winners) via campagnes publicitaires test et analyse du coût par acquisition.",
      basePrice: 25000,
      salePrice: 35000,
      type: "MARKETING"
    },
    {
      name: "Création de Contenu & Copywriting",
      description: "Rédaction publicitaire persuasive (copywriting), conception de visuels statiques, carrousels et assets graphiques orientés conversion.",
      basePrice: 20000,
      salePrice: 25000,
      type: "DESIGN"
    }
  ];

  for (const s of defaultServices) {
    const existing = await prisma.service.findFirst({
      where: { agencyId: agency.id, name: s.name }
    });
    if (!existing) {
      await prisma.service.create({
        data: { ...s, agencyId: agency.id }
      });
      console.log("Created service:", s.name);
    } else {
      await prisma.service.update({
        where: { id: existing.id },
        data: s
      });
      console.log("Updated service:", s.name);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
