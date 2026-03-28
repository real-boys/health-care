const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'healthcare.db');
const SCHEMA_PATH = path.join(__dirname, 'provider_directory_schema.sql');

async function initializeProviderDirectory() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('Connected to database at:', DB_PATH);

      // Read and execute schema
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      
      // Split schema into individual statements
      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      let completed = 0;
      let hasError = false;

      for (const statement of statements) {
        if (hasError) break;
        
        db.run(statement + ';', (err) => {
          if (err && !err.message.includes('already exists') && !err.message.includes('UNIQUE constraint')) {
            console.error('Error executing statement:', err.message);
            console.error('Statement:', statement.substring(0, 100) + '...');
            // Don't reject on "already exists" errors
            hasError = true;
          }
          completed++;
          if (completed === statements.length) {
            if (hasError) {
              console.log('Schema initialization completed with some warnings');
            } else {
              console.log('Schema initialization completed successfully');
            }
            resolve(db);
          }
        });
      }
    });
  });
}

async function seedSampleProviders(db) {
  console.log('Seeding sample providers...');
  
  const sampleProviders = [
    {
      npi_number: '1234567890',
      first_name: 'Sarah',
      last_name: 'Chen',
      professional_title: 'MD, FACC',
      bio: 'Dr. Sarah Chen is a board-certified cardiologist with over 12 years of experience in interventional cardiology. She specializes in minimally invasive cardiac procedures and has performed over 3,000 cardiac catheterizations.',
      phone: '+1 (555) 123-4567',
      email: 'sarah.chen@medcenter.com',
      website: 'www.drsarahchen.com',
      address_line1: '123 Medical Center Blvd',
      city: 'New York',
      state: 'NY',
      zip_code: '10016',
      latitude: 40.7484,
      longitude: -73.9857,
      practice_name: 'Manhattan Heart Center',
      practice_type: 'group',
      years_of_experience: 12,
      languages_spoken: JSON.stringify(['English', 'Mandarin', 'Spanish']),
      gender: 'Female',
      verification_status: 'verified',
      is_verified: 1,
      accepts_new_patients: 1,
      telehealth_available: 1,
      consultation_fee: 250,
      virtual_visit_price: 150,
      average_rating: 4.8,
      total_reviews: 156,
      insurance_accepted: JSON.stringify(['Aetna', 'Blue Cross Blue Shield', 'Medicare', 'UnitedHealth', 'Cigna']),
      hospital_affiliations: JSON.stringify(['Mount Sinai Hospital', 'NYU Langone Health']),
      education: JSON.stringify(['Harvard Medical School', 'Massachusetts General Hospital Residency']),
      board_certifications: JSON.stringify(['American Board of Internal Medicine', 'American Board of Cardiology']),
      conditions_treated: JSON.stringify(['Heart Disease', 'Chest Pain', 'Hypertension', 'Arrhythmia']),
      procedures_performed: JSON.stringify(['Cardiac Catheterization', 'Angioplasty', 'Stent Placement'])
    },
    {
      npi_number: '1234567891',
      first_name: 'Michael',
      last_name: 'Rodriguez',
      professional_title: 'MD, FAAOS',
      bio: 'Dr. Michael Rodriguez is a renowned orthopedic surgeon specializing in sports medicine. He has worked with professional athletes and is known for his innovative approaches to joint preservation and minimally invasive surgery.',
      phone: '+1 (555) 987-6543',
      email: 'm.rodriguez@sportsmed.com',
      website: 'www.drmichaelrodriguez.com',
      address_line1: '456 Sports Medicine Center',
      city: 'Los Angeles',
      state: 'CA',
      zip_code: '90024',
      latitude: 34.0689,
      longitude: -118.4452,
      practice_name: 'LA Sports Medicine Institute',
      practice_type: 'group',
      years_of_experience: 15,
      languages_spoken: JSON.stringify(['English', 'Spanish']),
      gender: 'Male',
      verification_status: 'verified',
      is_verified: 1,
      accepts_new_patients: 1,
      telehealth_available: 1,
      consultation_fee: 300,
      virtual_visit_price: 200,
      average_rating: 4.9,
      total_reviews: 203,
      insurance_accepted: JSON.stringify(['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'UnitedHealth']),
      hospital_affiliations: JSON.stringify(['Cedars-Sinai Medical Center', 'UCLA Medical Center']),
      education: JSON.stringify(['Johns Hopkins University', 'Mayo Clinic Residency']),
      board_certifications: JSON.stringify(['American Board of Orthopaedic Surgery']),
      conditions_treated: JSON.stringify(['Knee Injuries', 'Shoulder Injuries', 'Sports Injuries', 'Joint Pain']),
      procedures_performed: JSON.stringify(['ACL Reconstruction', 'Rotator Cuff Repair', 'Joint Replacement'])
    },
    {
      npi_number: '1234567892',
      first_name: 'Emily',
      last_name: 'Johnson',
      professional_title: 'MD, FAAP',
      bio: 'Dr. Emily Johnson is a compassionate pediatrician dedicated to providing comprehensive care for children from birth through adolescence. She has special expertise in neonatal care and developmental pediatrics.',
      phone: '+1 (555) 456-7890',
      email: 'e.johnson@childrenshospital.org',
      website: 'www.dremilyjohnson.com',
      address_line1: "789 Children's Hospital",
      city: 'Chicago',
      state: 'IL',
      zip_code: '60611',
      latitude: 41.8969,
      longitude: -87.6188,
      practice_name: "Lurie Children's Hospital Pediatrics",
      practice_type: 'hospital',
      years_of_experience: 10,
      languages_spoken: JSON.stringify(['English', 'French', 'German']),
      gender: 'Female',
      verification_status: 'verified',
      is_verified: 1,
      accepts_new_patients: 1,
      telehealth_available: 1,
      consultation_fee: 200,
      virtual_visit_price: 100,
      average_rating: 4.7,
      total_reviews: 189,
      insurance_accepted: JSON.stringify(['Blue Cross Blue Shield', 'Medicaid', 'UnitedHealth', 'Aetna']),
      hospital_affiliations: JSON.stringify(["Lurie Children's Hospital", 'Northwestern Memorial Hospital']),
      education: JSON.stringify(['Stanford University', "Children's Hospital of Philadelphia Residency"]),
      board_certifications: JSON.stringify(['American Board of Pediatrics', 'American Board of Neonatology']),
      conditions_treated: JSON.stringify(['Newborn Care', 'Child Development', 'Vaccinations', 'Pediatric Emergency']),
      procedures_performed: JSON.stringify(['Newborn Assessment', 'Developmental Screening', 'Circumcision'])
    },
    {
      npi_number: '1234567893',
      first_name: 'David',
      last_name: 'Kim',
      professional_title: 'MD, FACS',
      bio: 'Dr. David Kim is a board-certified plastic surgeon specializing in both cosmetic and reconstructive surgery. He combines artistic vision with surgical precision to deliver natural-looking results.',
      phone: '+1 (555) 234-5678',
      email: 'd.kim@ aesthetics.com',
      website: 'www.drdavidkim.com',
      address_line1: '321 Aesthetic Surgery Center',
      city: 'Miami',
      state: 'FL',
      zip_code: '33101',
      latitude: 25.7617,
      longitude: -80.1918,
      practice_name: 'Miami Aesthetic Surgery',
      practice_type: 'solo',
      years_of_experience: 8,
      languages_spoken: JSON.stringify(['English', 'Korean', 'Spanish']),
      gender: 'Male',
      verification_status: 'verified',
      is_verified: 1,
      accepts_new_patients: 1,
      telehealth_available: 0,
      consultation_fee: 175,
      virtual_visit_price: null,
      average_rating: 4.6,
      total_reviews: 124,
      insurance_accepted: JSON.stringify(['Blue Cross Blue Shield', 'Aetna']),
      hospital_affiliations: JSON.stringify(['Jackson Memorial Hospital']),
      education: JSON.stringify(['Yale School of Medicine', 'NYU Plastic Surgery Residency']),
      board_certifications: JSON.stringify(['American Board of Plastic Surgery']),
      conditions_treated: JSON.stringify(['Cosmetic Concerns', 'Skin Cancer', 'Trauma', 'Congenital Defects']),
      procedures_performed: JSON.stringify(['Facelift', 'Breast Augmentation', 'Rhinoplasty', 'Liposuction'])
    },
    {
      npi_number: '1234567894',
      first_name: 'Amanda',
      last_name: 'Williams',
      professional_title: 'MD, FACOG',
      bio: 'Dr. Amanda Williams is an experienced OB/GYN providing comprehensive women\'s health care. She specializes in high-risk pregnancies and minimally invasive gynecologic surgery.',
      phone: '+1 (555) 345-6789',
      email: 'a.williams@womenshealth.com',
      website: 'www.dramandawilliams.com',
      address_line1: '555 Women\'s Health Center',
      city: 'Houston',
      state: 'TX',
      zip_code: '77030',
      latitude: 29.7071,
      longitude: -95.3988,
      practice_name: 'Houston Women\'s Health Associates',
      practice_type: 'group',
      years_of_experience: 14,
      languages_spoken: JSON.stringify(['English', 'Spanish']),
      gender: 'Female',
      verification_status: 'verified',
      is_verified: 1,
      accepts_new_patients: 1,
      telehealth_available: 1,
      consultation_fee: 225,
      virtual_visit_price: 125,
      average_rating: 4.8,
      total_reviews: 178,
      insurance_accepted: JSON.stringify(['Blue Cross Blue Shield', 'Aetna', 'Cigna', 'Medicare', 'Medicaid']),
      hospital_affiliations: JSON.stringify(['Texas Medical Center', 'Houston Methodist Hospital']),
      education: JSON.stringify(['Baylor College of Medicine', 'Duke University Residency']),
      board_certifications: JSON.stringify(['American Board of Obstetrics and Gynecology']),
      conditions_treated: JSON.stringify(['Pregnancy', 'Prenatal Care', 'Menstrual Disorders', 'Menopause']),
      procedures_performed: JSON.stringify(['C-Section', 'Hysterectomy', 'Laparoscopy', 'IUD Insertion'])
    }
  ];

  // Insert providers
  const insertProvider = (provider) => {
    return new Promise((resolve, reject) => {
      const columns = Object.keys(provider).join(', ');
      const placeholders = Object.keys(provider).map(() => '?').join(', ');
      const values = Object.values(provider);

      const query = `
        INSERT OR IGNORE INTO healthcare_providers (${columns})
        VALUES (${placeholders})
      `;

      db.run(query, values, function(err) {
        if (err) {
          console.error('Error inserting provider:', err.message);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  };

  // Insert specialty mappings
  const insertSpecialty = (providerId, specialtyName, isPrimary) => {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO provider_specialties_map (provider_id, specialty_id, is_primary)
        SELECT ?, id, ?
        FROM provider_specialties
        WHERE name LIKE ?
      `;

      db.run(query, [providerId, isPrimary ? 1 : 0, `%${specialtyName}%`], (err) => {
        if (err) {
          console.error('Error inserting specialty:', err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  // Insert availability
  const insertAvailability = (providerId, dayOfWeek, opening, closing, duration = 30) => {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO provider_availability 
        (provider_id, day_of_week, opening_time, closing_time, is_available, appointment_duration_minutes, break_start_time, break_end_time)
        VALUES (?, ?, ?, ?, 1, ?, '12:00', '13:00')
      `;

      db.run(query, [providerId, dayOfWeek, opening, closing, duration], (err) => {
        if (err) {
          console.error('Error inserting availability:', err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  try {
    for (const provider of sampleProviders) {
      const providerId = await insertProvider(provider);
      if (providerId) {
        console.log(`Inserted provider: Dr. ${provider.first_name} ${provider.last_name} (ID: ${providerId})`);
        
        // Add specialty mapping
        const specialtyMap = {
          'Sarah Chen': ['Cardiology', 'Internal Medicine'],
          'Michael Rodriguez': ['Orthopedics', 'General Surgery'],
          'Emily Johnson': ['Pediatrics', 'Family Medicine'],
          'David Kim': ['Plastic Surgery', 'General Surgery'],
          'Amanda Williams': ['OB/GYN', 'General Surgery']
        };

        const specialties = specialtyMap[`${provider.first_name} ${provider.last_name}`] || [];
        for (let i = 0; i < specialties.length; i++) {
          await insertSpecialty(providerId, specialties[i], i === 0);
        }

        // Add standard availability (Mon-Fri 9am-5pm, Sat 9am-1pm)
        for (let day = 1; day <= 5; day++) {
          await insertAvailability(providerId, day, '09:00', '17:00', 30);
        }
        await insertAvailability(providerId, 6, '09:00', '13:00', 30);
      }
    }

    console.log('Sample providers seeded successfully');
  } catch (error) {
    console.error('Error seeding providers:', error);
  }
}

async function main() {
  try {
    const db = await initializeProviderDirectory();
    await seedSampleProviders(db);
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

main();
