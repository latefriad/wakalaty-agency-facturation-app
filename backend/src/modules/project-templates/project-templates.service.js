const prisma = require("../../config/database");
const tasksService = require("../tasks/tasks.service");

const DEFAULT_TEMPLATES_SEED = [
  {
    name: "Création de Site Web & Landing Page",
    serviceType: "WEBSITE",
    description: "Cycle complet de livraison de site web vitrine ou e-commerce avec tunnel de conversion.",
    tasks: [
      {
        title: "Cadrage, Brief & Cahier des charges",
        description: "Recueil des besoins client, arborescence, charte graphique et objectifs de conversion.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 0,
        defaultRole: "ADMIN",
        order: 1,
      },
      {
        title: "Design Wireframes & Maquettes UX/UI",
        description: "Conception visuelle desktop et mobile pour validation client.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 3,
        defaultRole: "DESIGNER",
        order: 2,
      },
      {
        title: "Développement & Intégration technique",
        description: "Mise en place de la solution, intégration des pages, formulaire et passerelles.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 7,
        defaultRole: "EDITOR",
        order: 3,
      },
      {
        title: "Recette, Tests Responsivité & Vitesse",
        description: "Contrôle qualité sur mobile, tablette et desktop, test des formulaires et pixels.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 12,
        defaultRole: "ADMIN",
        order: 4,
      },
      {
        title: "Livraison finale & Formation client",
        description: "Mise en ligne sous domaine définitif et transmission des accès administrateur.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 14,
        defaultRole: "ADMIN",
        order: 5,
      },
    ],
  },
  {
    name: "Campagne Meta Ads (Media Buying & Scaling)",
    serviceType: "META_ADS",
    description: "Lancement, suivi et scaling de campagnes publicitaires Meta (Facebook & Instagram).",
    tasks: [
      {
        title: "Audit du compte publicitaire & Pixel/CAPI",
        description: "Vérification des événements de conversion, du domaine et de l'historique publicitaire.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 0,
        defaultRole: "ADS",
        order: 1,
      },
      {
        title: "Création des visuels, vidéos & Copywriting",
        description: "Production des formats 9:16 et 1:1 avec hooks percutants et propositions de valeur.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 2,
        defaultRole: "DESIGNER",
        order: 2,
      },
      {
        title: "Configuration technique & Lancement des campagnes",
        description: "Paramétrage des audiences (Broad / Lookalike), des budgets CBO/ABO et UTM.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 4,
        defaultRole: "ADS",
        order: 3,
      },
      {
        title: "Optimisation hebdomadaire & Scaling",
        description: "Coupure des créatifs non performants, scaling vertical/horizontal sur les winners.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 11,
        defaultRole: "ADS",
        order: 4,
      },
      {
        title: "Bilan mensuel & Rapport ROAS/CPA",
        description: "Analyse approfondie des performances et ajustements de la stratégie pour le mois suivant.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 28,
        defaultRole: "ADS",
        order: 5,
      },
    ],
  },
  {
    name: "Testili - Validation Produit E-commerce",
    serviceType: "TESTILI",
    description: "Protocole rigoureux de test et validation de produit gagnant (Winner detection).",
    tasks: [
      {
        title: "Analyse produit & Étude de concurrence",
        description: "Étude des angles marketing, avatars clients et fixation du CPA cible.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 0,
        defaultRole: "ADS",
        order: 1,
      },
      {
        title: "Production des créatifs publicitaires de test",
        description: "3 déclinaisons de hooks vidéo et 2 formats statiques axés sur les bénéfices.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 2,
        defaultRole: "VIDEO",
        order: 2,
      },
      {
        title: "Lancement du test avec budget dédié",
        description: "Déploiement du budget de validation sur Meta / TikTok selon le protocole Testili.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 3,
        defaultRole: "ADS",
        order: 3,
      },
      {
        title: "Suivi des métriques clés (CPA, ROAS, Taux d'ajout)",
        description: "Monitoring en direct du coût d'acquisition par rapport au seuil de rentabilité.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 6,
        defaultRole: "ADS",
        order: 4,
      },
      {
        title: "Verdict final Winner / Loser & Recommandation",
        description: "Décision d'industrialisation ou arrêt du produit avec rapport détaillé au client.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 7,
        defaultRole: "ADS",
        order: 5,
      },
    ],
  },
  {
    name: "Voice Off Professionnelle",
    serviceType: "VOICE_OFF",
    description: "Enregistrement studio voix off pour spots publicitaires et vidéos de marque.",
    tasks: [
      {
        title: "Réception du script & Brief vocal",
        description: "Validation du ton, du rythme et des prononciations spécifiques avec le client.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 0,
        defaultRole: "EMPLOYEE",
        order: 1,
      },
      {
        title: "Enregistrement studio & Nettoyage audio",
        description: "Prises de son studio professionnelles et mastering de base.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 2,
        defaultRole: "EMPLOYEE",
        order: 2,
      },
      {
        title: "Ajustements & Retouches éventuelles",
        description: "Intégration des retours client sur les intonations ou passages particuliers.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 3,
        defaultRole: "EMPLOYEE",
        order: 3,
      },
      {
        title: "Livraison des fichiers audio finaux HQ",
        description: "Export WAV 24-bit et MP3 320kbps prêts pour le mixage vidéo.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 4,
        defaultRole: "EMPLOYEE",
        order: 4,
      },
    ],
  },
  {
    name: "Montage Vidéo Publicitaire & Motion Design",
    serviceType: "VIDEO_EDITING",
    description: "Montage vidéo haute conversion adapté aux formats Reels, TikTok et Shorts.",
    tasks: [
      {
        title: "Réception des rushs & Storyboard",
        description: "Organisation des éléments graphiques, voix off et sélection des meilleurs plans.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 0,
        defaultRole: "VIDEO",
        order: 1,
      },
      {
        title: "Montage rythmé, Effets sonores & Sous-titres",
        description: "Application du hook visuel dans les 3 premières secondes et sous-titres animés.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 3,
        defaultRole: "VIDEO",
        order: 2,
      },
      {
        title: "Révisions & Retours du client",
        description: "Ajustement du rythme, étalonnage des couleurs et corrections demandées.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 5,
        defaultRole: "VIDEO",
        order: 3,
      },
      {
        title: "Export final 4K & Livraison des déclinaisons",
        description: "Fourniture des formats finaux optimisés pour chaque régie publicitaire.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 6,
        defaultRole: "VIDEO",
        order: 4,
      },
    ],
  },
  {
    name: "Création de Contenu & Copywriting",
    serviceType: "CONTENT",
    description: "Production de contenus engageants et rédaction persuasive pour réseaux sociaux.",
    tasks: [
      {
        title: "Calendrier éditorial & Angles marketing",
        description: "Planification des piliers de contenu et messages clés du mois.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 0,
        defaultRole: "EDITOR",
        order: 1,
      },
      {
        title: "Rédaction des copies & Direction artistique",
        description: "Création des textes persuasifs et visuels associés respectant la charte.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 4,
        defaultRole: "DESIGNER",
        order: 2,
      },
      {
        title: "Validation & Ajustements client",
        description: "Revue globale avec le client et intégration des dernières modifications.",
        defaultPriority: "MEDIUM",
        dayOffsetFromStart: 7,
        defaultRole: "EDITOR",
        order: 3,
      },
      {
        title: "Livraison du pack mensuel complet",
        description: "Remise de l'ensemble des créas prêtes pour programmation et diffusion.",
        defaultPriority: "HIGH",
        dayOffsetFromStart: 10,
        defaultRole: "EDITOR",
        order: 4,
      },
    ],
  },
];

async function listTemplates(agencyId, query = {}) {
  const where = { agencyId };
  if (query.serviceType) {
    where.serviceType = query.serviceType;
  }

  const templates = await prisma.projectTemplate.findMany({
    where,
    include: {
      tasks: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return templates;
}

async function getTemplateById(agencyId, id) {
  const template = await prisma.projectTemplate.findFirst({
    where: { id, agencyId },
    include: {
      tasks: {
        orderBy: { order: "asc" },
      },
    },
  });

  return template;
}

async function createTemplate(agencyId, data) {
  const { name, serviceType, description, tasks = [] } = data;

  if (!name || !name.trim()) {
    throw new Error("Template name is required");
  }

  const template = await prisma.projectTemplate.create({
    data: {
      agencyId,
      name: name.trim(),
      serviceType: serviceType || "META_ADS",
      description: description ? description.trim() : null,
      tasks: {
        create: tasks.map((t, idx) => ({
          title: t.title.trim(),
          description: t.description ? t.description.trim() : null,
          defaultPriority: t.defaultPriority || "MEDIUM",
          dayOffsetFromStart: Math.max(0, parseInt(t.dayOffsetFromStart || 0, 10)),
          defaultRole: t.defaultRole || null,
          order: t.order ?? idx + 1,
        })),
      },
    },
    include: {
      tasks: {
        orderBy: { order: "asc" },
      },
    },
  });

  return template;
}

async function updateTemplate(agencyId, id, data) {
  const existing = await prisma.projectTemplate.findFirst({
    where: { id, agencyId },
  });
  if (!existing) {
    throw new Error("Template not found");
  }

  const { name, serviceType, description, tasks } = data;

  // Transaction to update template and rewrite its tasks if provided
  return prisma.$transaction(async (tx) => {
    const updated = await tx.projectTemplate.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(serviceType ? { serviceType } : {}),
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
      },
    });

    if (Array.isArray(tasks)) {
      // Delete old tasks and replace with updated ones
      await tx.projectTemplateTask.deleteMany({
        where: { templateId: id },
      });

      if (tasks.length > 0) {
        await tx.projectTemplateTask.createMany({
          data: tasks.map((t, idx) => ({
            templateId: id,
            title: t.title.trim(),
            description: t.description ? t.description.trim() : null,
            defaultPriority: t.defaultPriority || "MEDIUM",
            dayOffsetFromStart: Math.max(0, parseInt(t.dayOffsetFromStart || 0, 10)),
            defaultRole: t.defaultRole || null,
            order: t.order ?? idx + 1,
          })),
        });
      }
    }

    return tx.projectTemplate.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { order: "asc" },
        },
      },
    });
  });
}

async function deleteTemplate(agencyId, id) {
  const existing = await prisma.projectTemplate.findFirst({
    where: { id, agencyId },
  });
  if (!existing) {
    throw new Error("Template not found");
  }

  await prisma.projectTemplate.delete({
    where: { id },
  });

  return { success: true };
}

async function seedDefaultTemplates(agencyId) {
  const created = [];

  for (const tpl of DEFAULT_TEMPLATES_SEED) {
    // Check if already seeded with same name
    const existing = await prisma.projectTemplate.findFirst({
      where: { agencyId, name: tpl.name },
    });

    if (!existing) {
      const newTpl = await prisma.projectTemplate.create({
        data: {
          agencyId,
          name: tpl.name,
          serviceType: tpl.serviceType,
          description: tpl.description,
          tasks: {
            create: tpl.tasks.map((t) => ({
              title: t.title,
              description: t.description,
              defaultPriority: t.defaultPriority,
              dayOffsetFromStart: t.dayOffsetFromStart,
              defaultRole: t.defaultRole,
              order: t.order,
            })),
          },
        },
        include: {
          tasks: true,
        },
      });
      created.push(newTpl);
    }
  }

  return {
    seededCount: created.length,
    templates: await listTemplates(agencyId),
  };
}

async function applyTemplate(user, id, { clientId, startDate }) {
  if (!clientId) {
    throw new Error("Client ID is required");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId: user.agencyId },
  });
  if (!client) {
    throw new Error("Client not found");
  }

  const template = await prisma.projectTemplate.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      tasks: {
        orderBy: { order: "asc" },
      },
    },
  });
  if (!template) {
    throw new Error("Template not found");
  }

  if (template.tasks.length === 0) {
    throw new Error("Template has no tasks to apply");
  }

  const baseDate = startDate ? new Date(startDate) : new Date();
  baseDate.setHours(9, 0, 0, 0);

  // Fetch employees to match defaultRole if possible
  const employees = await prisma.employee.findMany({
    where: { agencyId: user.agencyId, status: "ACTIVE" },
  });

  const createdTasks = [];

  for (const t of template.tasks) {
    const taskDue = new Date(baseDate.getTime() + t.dayOffsetFromStart * 24 * 60 * 60 * 1000);
    taskDue.setHours(18, 0, 0, 0);

    // If role matches an employee, assign them
    const matchingEmployee = t.defaultRole
      ? employees.find((emp) => emp.role === t.defaultRole)
      : null;

    const taskPayload = {
      title: `${t.title} (${client.name})`,
      description: t.description || `Étape du modèle "${template.name}"`,
      priority: t.defaultPriority || "MEDIUM",
      status: "TODO",
      startDate: baseDate,
      dueDate: taskDue,
      clientId: client.id,
      employeeId: matchingEmployee ? matchingEmployee.id : null,
    };

    // Call existing task creation logic!
    const createdTask = await tasksService.create(user, taskPayload);
    createdTasks.push(createdTask);
  }

  return {
    success: true,
    appliedTasksCount: createdTasks.length,
    tasks: createdTasks,
    templateName: template.name,
    clientName: client.name,
  };
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  seedDefaultTemplates,
  applyTemplate,
};
