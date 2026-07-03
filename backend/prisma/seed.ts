import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin user ──────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@healthcare.local' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@healthcare.local',
      passwordHash: await bcrypt.hash('Admin@1234', 12),
      role: Role.ADMIN,
      phone: '+1000000000',
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // ── Doctor 1 ─────────────────────────────────────────────────────────────
  const doc1User = await prisma.user.upsert({
    where: { email: 'dr.sharma@healthcare.local' },
    update: {},
    create: {
      name: 'Dr. Priya Sharma',
      email: 'dr.sharma@healthcare.local',
      passwordHash: await bcrypt.hash('Doctor@1234', 12),
      role: Role.DOCTOR,
      phone: '+1000000001',
    },
  });

  await prisma.doctorProfile.upsert({
    where: { userId: doc1User.id },
    update: {},
    create: {
      userId: doc1User.id,
      specialisation: 'Cardiology',
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
      slotDurationMinutes: 30,
      workingDays: [1, 2, 3, 4, 5], // Mon–Fri
    },
  });
  console.log(`✅ Doctor 1: ${doc1User.email} (Cardiology)`);

  // ── Doctor 2 ─────────────────────────────────────────────────────────────
  const doc2User = await prisma.user.upsert({
    where: { email: 'dr.mehta@healthcare.local' },
    update: {},
    create: {
      name: 'Dr. Rohan Mehta',
      email: 'dr.mehta@healthcare.local',
      passwordHash: await bcrypt.hash('Doctor@1234', 12),
      role: Role.DOCTOR,
      phone: '+1000000002',
    },
  });

  await prisma.doctorProfile.upsert({
    where: { userId: doc2User.id },
    update: {},
    create: {
      userId: doc2User.id,
      specialisation: 'General Medicine',
      workingHoursStart: '10:00',
      workingHoursEnd: '18:00',
      slotDurationMinutes: 15,
      workingDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
    },
  });
  console.log(`✅ Doctor 2: ${doc2User.email} (General Medicine)`);

  // ── Sample patient ────────────────────────────────────────────────────────
  const patient = await prisma.user.upsert({
    where: { email: 'patient@healthcare.local' },
    update: {},
    create: {
      name: 'Aisha Patel',
      email: 'patient@healthcare.local',
      passwordHash: await bcrypt.hash('Patient@1234', 12),
      role: Role.PATIENT,
      phone: '+1000000003',
    },
  });
  console.log(`✅ Patient: ${patient.email}`);

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('  Admin:   admin@healthcare.local       / Admin@1234');
  console.log('  Doctor1: dr.sharma@healthcare.local   / Doctor@1234  (Cardiology)');
  console.log('  Doctor2: dr.mehta@healthcare.local    / Doctor@1234  (General Medicine)');
  console.log('  Patient: patient@healthcare.local     / Patient@1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
