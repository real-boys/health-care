const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/healthcare_providers'
});

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    await pool.query('BEGIN');

    // Seed users
    await seedUsers();
    
    // Seed provider specialties and credentials
    await seedProviderData();
    
    // Seed healthcare providers
    await seedProviders();
    
    // Seed patients
    await seedPatients();
    
    // Seed sample reviews
    await seedReviews();

    await pool.query('COMMIT');
    console.log('✅ Database seeding completed successfully!');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function seedUsers() {
  console.log('👥 Seeding users...');

  const users = [
    {
      email: 'admin@healthcare.com',
      password: 'admin123',
      role: 'admin',
      first_name: 'Admin',
      last_name: 'User'
    },
    {
      email: 'provider1@healthcare.com',
      password: 'provider123',
      role: 'provider',
      first_name: 'John',
      last_name: 'Smith'
    },
    {
      email: 'provider2@healthcare.com',
      password: 'provider123',
      role: 'provider',
      first_name: 'Sarah',
      last_name: 'Johnson'
    },
    {
      email: 'patient1@healthcare.com',
      password: 'patient123',
      role: 'patient',
      first_name: 'Michael',
      last_name: 'Brown'
    },
    {
      email: 'patient2@healthcare.com',
      password: 'patient123',
      role: 'patient',
      first_name: 'Emily',
      last_name: 'Davis'
    }
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    
    await pool.query(`
      INSERT INTO users (email, password, role, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, [user.email, hashedPassword, user.role, user.first_name, user.last_name]);
  }

  console.log('✅ Users seeded successfully');
}

async function seedProviderData() {
  console.log('🏥 Seeding provider specialties and credentials...');

  // Additional specialties
  const specialties = [
    { name: 'Pediatrics', description: 'Medical care for infants, children, and adolescents', category: 'medical' },
    { name: 'Cardiology', description: 'Heart and cardiovascular system disorders', category: 'medical' },
    { name: 'Dermatology', description: 'Skin, hair, and nail conditions', category: 'medical' },
    { name: 'Orthopedics', description: 'Musculoskeletal system and joints', category: 'surgical' },
    { name: 'Psychiatry', description: 'Mental health disorders', category: 'medical' },
    { name: 'Obstetrics & Gynecology', description: 'Women\'s health and pregnancy care', category: 'medical' },
    { name: 'Neurology', description: 'Nervous system disorders', category: 'medical' },
    { name: 'Oncology', description: 'Cancer diagnosis and treatment', category: 'medical' },
    { name: 'Gastroenterology', description: 'Digestive system disorders', category: 'medical' },
    { name: 'Endocrinology', description: 'Hormonal and metabolic disorders', category: 'medical' }
  ];

  for (const specialty of specialties) {
    await pool.query(`
      INSERT INTO provider_specialties (name, description, category)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO NOTHING
    `, [specialty.name, specialty.description, specialty.category]);
  }

  // Additional credentials
  const credentials = [
    { name: 'Board Certification - Internal Medicine', issuing_organization: 'American Board of Internal Medicine', credential_type: 'board_certification', expiry_period_years: 10 },
    { name: 'Board Certification - Pediatrics', issuing_organization: 'American Board of Pediatrics', credential_type: 'board_certification', expiry_period_years: 10 },
    { name: 'Board Certification - Cardiology', issuing_organization: 'American Board of Internal Medicine', credential_type: 'board_certification', expiry_period_years: 10 },
    { name: 'State Medical License - New York', issuing_organization: 'New York State Department of Health', credential_type: 'license', expiry_period_years: 2 },
    { name: 'State Medical License - California', issuing_organization: 'Medical Board of California', credential_type: 'license', expiry_period_years: 2 },
    { name: 'DEA Registration', issuing_organization: 'Drug Enforcement Administration', credential_type: 'license', expiry_period_years: 2 },
    { name: 'ACLS Certification', issuing_organization: 'American Heart Association', credential_type: 'certificate', expiry_period_years: 2 },
    { name: 'BLS Certification', issuing_organization: 'American Heart Association', credential_type: 'certificate', expiry_period_years: 2 }
  ];

  for (const credential of credentials) {
    await pool.query(`
      INSERT INTO provider_credentials (name, issuing_organization, credential_type, expiry_period_years)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [credential.name, credential.issuing_organization, credential.credential_type, credential.expiry_period_years]);
  }

  console.log('✅ Provider data seeded successfully');
}

async function seedProviders() {
  console.log('👨‍⚕️ Seeding healthcare providers...');

  // Get user IDs for providers
  const userResult = await pool.query(`
    SELECT id, email FROM users WHERE role = 'provider'
  `);

  // Get specialty and credential IDs
  const specialtyResult = await pool.query(`
    SELECT id, name FROM provider_specialties LIMIT 5
  `);

  const credentialResult = await pool.query(`
    SELECT id, name FROM provider_credentials LIMIT 3
  `);

  const providers = [
    {
      user_id: userResult.rows[0]?.id,
      npi_number: '1234567890',
      first_name: 'John',
      last_name: 'Smith',
      professional_title: 'MD',
      bio: 'Experienced cardiologist with over 15 years of practice. Specialized in interventional cardiology and preventive care.',
      profile_image_url: null,
      phone: '+1-555-0123',
      email: 'john.smith@cardiology.com',
      website: 'https://www.johnsmithmd.com',
      address_line1: '123 Medical Center Blvd',
      address_line2: 'Suite 400',
      city: 'New York',
      state: 'NY',
      zip_code: '10001',
      country: 'USA',
      practice_name: 'Manhattan Cardiology Associates',
      practice_type: 'group',
      years_of_experience: 15,
      languages_spoken: ['English', 'Spanish'],
      is_verified: true,
      verification_status: 'verified',
      verification_date: new Date('2023-01-15'),
      accepts_new_patients: true,
      telehealth_available: true,
      average_rating: 4.8,
      total_reviews: 127
    },
    {
      user_id: userResult.rows[1]?.id,
      npi_number: '0987654321',
      first_name: 'Sarah',
      last_name: 'Johnson',
      professional_title: 'MD',
      bio: 'Board-certified pediatrician dedicated to providing comprehensive care for children from birth through adolescence.',
      profile_image_url: null,
      phone: '+1-555-0124',
      email: 'sarah.johnson@pediatrics.com',
      website: 'https://www.sarahjohnsonmd.com',
      address_line1: '456 Children\'s Way',
      city: 'Los Angeles',
      state: 'CA',
      zip_code: '90001',
      country: 'USA',
      practice_name: 'Sunshine Pediatrics',
      practice_type: 'solo',
      years_of_experience: 12,
      languages_spoken: ['English', 'Spanish', 'French'],
      is_verified: true,
      verification_status: 'verified',
      verification_date: new Date('2023-02-20'),
      accepts_new_patients: true,
      telehealth_available: true,
      average_rating: 4.9,
      total_reviews: 89
    }
  ];

  for (const provider of providers) {
    if (!provider.user_id) continue;

    // Insert provider with location
    const providerResult = await pool.query(`
      INSERT INTO healthcare_providers (
        user_id, npi_number, first_name, last_name, professional_title, bio,
        phone, email, website, address_line1, address_line2, city, state,
        zip_code, country, practice_name, practice_type, years_of_experience,
        languages_spoken, is_verified, verification_status, verification_date,
        accepts_new_patients, telehealth_available, average_rating, total_reviews,
        location
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
        ST_MakePoint($27, $28))
      RETURNING id
    `, [
      provider.user_id, provider.npi_number, provider.first_name, provider.last_name,
      provider.professional_title, provider.bio, provider.phone, provider.email,
      provider.website, provider.address_line1, provider.address_line2, provider.city,
      provider.state, provider.zip_code, provider.country, provider.practice_name,
      provider.practice_type, provider.years_of_experience, provider.languages_spoken,
      provider.is_verified, provider.verification_status, provider.verification_date,
      provider.accepts_new_patients, provider.telehealth_available,
      provider.average_rating, provider.total_reviews,
      // Location coordinates (NYC and LA)
      provider.city === 'New York' ? -74.0060 : -118.2437,
      provider.city === 'New York' ? 40.7128 : 34.0522
    ]);

    const providerId = providerResult.rows[0].id;

    // Add specialties
    const primarySpecialty = specialtyResult.rows[0];
    const secondarySpecialty = specialtyResult.rows[1];

    await pool.query(`
      INSERT INTO provider_specialties_map (provider_id, specialty_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT DO NOTHING
    `, [providerId, primarySpecialty.id]);

    if (secondarySpecialty) {
      await pool.query(`
        INSERT INTO provider_specialties_map (provider_id, specialty_id, is_primary)
        VALUES ($1, $2, false)
        ON CONFLICT DO NOTHING
      `, [providerId, secondarySpecialty.id]);
    }

    // Add credentials
    for (let i = 0; i < 2; i++) {
      const credential = credentialResult.rows[i];
      await pool.query(`
        INSERT INTO provider_credentials_map (provider_id, credential_id, credential_number, issue_date, expiry_date, verification_status)
        VALUES ($1, $2, $3, $4, $5, 'verified')
        ON CONFLICT DO NOTHING
      `, [
        providerId, credential.id,
        `${provider.npi_number}-${credential.id}`,
        new Date('2020-01-01'),
        new Date('2030-12-31')
      ]);
    }

    // Add availability schedule
    for (let day = 0; day < 5; day++) { // Monday to Friday
      await pool.query(`
        INSERT INTO provider_availability (
          provider_id, day_of_week, opening_time, closing_time,
          appointment_duration_minutes, is_available
        ) VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT DO NOTHING
      `, [providerId, day, '09:00', '17:00', 30]);
    }
  }

  console.log('✅ Healthcare providers seeded successfully');
}

async function seedPatients() {
  console.log('👶 Seeding patients...');

  const userResult = await pool.query(`
    SELECT id, email FROM users WHERE role = 'patient'
  `);

  const patients = [
    {
      user_id: userResult.rows[0]?.id,
      medical_record_number: 'MRN001',
      insurance_provider: 'Blue Cross Blue Shield',
      insurance_policy_number: 'BCBS123456',
      emergency_contact_name: 'Jane Brown',
      emergency_contact_phone: '+1-555-0125',
      blood_type: 'O+',
      allergies: 'Penicillin',
      medications: 'Lisinopril 10mg daily'
    },
    {
      user_id: userResult.rows[1]?.id,
      medical_record_number: 'MRN002',
      insurance_provider: 'Aetna',
      insurance_policy_number: 'AET789012',
      emergency_contact_name: 'Robert Davis',
      emergency_contact_phone: '+1-555-0126',
      blood_type: 'A+',
      allergies: 'None',
      medications: 'None'
    }
  ];

  for (const patient of patients) {
    if (!patient.user_id) continue;

    await pool.query(`
      INSERT INTO patients (
        user_id, medical_record_number, insurance_provider, insurance_policy_number,
        emergency_contact_name, emergency_contact_phone, blood_type, allergies, medications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (medical_record_number) DO NOTHING
    `, [
      patient.user_id, patient.medical_record_number, patient.insurance_provider,
      patient.insurance_policy_number, patient.emergency_contact_name,
      patient.emergency_contact_phone, patient.blood_type, patient.allergies, patient.medications
    ]);
  }

  console.log('✅ Patients seeded successfully');
}

async function seedReviews() {
  console.log('⭐ Seeding reviews...');

  // Get providers and patients
  const providerResult = await pool.query(`
    SELECT id, first_name, last_name FROM healthcare_providers WHERE is_verified = true
  `);

  const patientResult = await pool.query(`
    SELECT p.id, u.first_name, u.last_name 
    FROM patients p 
    JOIN users u ON p.user_id = u.id
  `);

  const reviewTemplates = [
    {
      title: 'Excellent Doctor!',
      review_text: 'Dr. Smith is an amazing cardiologist. He took the time to explain everything clearly and made me feel comfortable throughout the entire process.',
      overall_rating: 5,
      bedside_manner_rating: 5,
      wait_time_rating: 4,
      staff_friendliness_rating: 5
    },
    {
      title: 'Very Professional',
      review_text: 'Professional, knowledgeable, and caring. The staff was also very friendly and helpful.',
      overall_rating: 4,
      bedside_manner_rating: 4,
      wait_time_rating: 3,
      staff_friendliness_rating: 5
    },
    {
      title: 'Great with Kids!',
      review_text: 'Dr. Johnson is wonderful with children. My kids actually look forward to their appointments!',
      overall_rating: 5,
      bedside_manner_rating: 5,
      wait_time_rating: 5,
      staff_friendliness_rating: 5
    },
    {
      title: 'Highly Recommended',
      review_text: 'I would definitely recommend Dr. Johnson to any parent looking for a caring and competent pediatrician.',
      overall_rating: 5,
      bedside_manner_rating: 5,
      wait_time_rating: 4,
      staff_friendliness_rating: 4
    }
  ];

  for (const provider of providerResult.rows) {
    for (let i = 0; i < 5; i++) { // 5 reviews per provider
      const patient = patientResult.rows[i % patientResult.rows.length];
      const template = reviewTemplates[i % reviewTemplates.length];

      await pool.query(`
        INSERT INTO provider_reviews (
          provider_id, patient_id, overall_rating, bedside_manner_rating,
          wait_time_rating, staff_friendliness_rating, title, review_text,
          moderation_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved')
        ON CONFLICT DO NOTHING
      `, [
        provider.id, patient.id, template.overall_rating, template.bedside_manner_rating,
        template.wait_time_rating, template.staff_friendliness_rating,
        template.title, template.review_text
      ]);
    }
  }

  console.log('✅ Reviews seeded successfully');
}

// Run the seeding
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
