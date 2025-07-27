// prisma/seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Créer des projets d'exemple
  const project1 = await prisma.project.create({
    data: {
      id: 'seed-project-1',
      name: 'Sample Project 1',
      description: 'A sample project for development',
      initialPrompt: 'Create a web application for task management',
      ownerId: 'seed-user-1',
      status: 'ACTIVE',
      uploadedFileIds: [],
      generatedFileIds: [],
    },
  });

  const project2 = await prisma.project.create({
    data: {
      id: 'seed-project-2',
      name: 'Sample Project 2',
      description: 'Another sample project',
      initialPrompt: 'Build a mobile app for fitness tracking',
      ownerId: 'seed-user-2',
      status: 'ACTIVE',
      uploadedFileIds: [],
      generatedFileIds: [],
    },
  });

  // Créer des statistiques d'exemple
  await prisma.projectStatistics.create({
    data: {
      id: 'stats-1',
      projectId: project1.id,
      costs: {
        claudeApi: 15.50,
        storage: 2.30,
        compute: 8.75,
        total: 26.55,
      },
      performance: {
        generationTime: 45000,
        processingTime: 12000,
        totalTime: 57000,
      },
      usage: {
        documentsGenerated: 5,
        filesProcessed: 3,
        tokensUsed: 25000,
      },
    },
  });

  console.log('✅ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });