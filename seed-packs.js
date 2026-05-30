const mongoose = require('mongoose');
const Pack = require('./models/Pack');

const MONGODB_URI = 'mongodb+srv://hamzatricks:hamzatricks@cluster0.sjxud.mongodb.net/konica';

const packs = [
  {
    name: 'Pack Basique',
    description: 'Forfait de base incluant photographe et caméraman avec vidéo montée et photos traitées sur clé USB.',
    price: 18000,
    features: [
      'Photographe et caméraman',
      'LA VIDEO AVEC MONTAGE',
      'LES PHOTOS AVEC TRAITEMENT',
      '(TOUTES SUR USB)',
    ],
    photo: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
  },
  {
    name: 'Pack Classique',
    description: 'Forfait classique avec album 100 photos, cadre 30x40cm, vidéo montée et photos illimitées sur clé USB.',
    price: 21000,
    features: [
      'Photographe et caméraman',
      'ALBUM 100 PHOTO',
      'CADRE 30cm x 40cm',
      'LA VIDEO AVEC MONTAGE',
      'Les photos illimitées Sur Clé USB',
    ],
    photo: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800',
  },
  {
    name: 'Pack Silver',
    description: 'Forfait silver avec photobook, cadre 30x40cm, vidéo montée et photos illimitées sur clé USB.',
    price: 24000,
    features: [
      'Photographe et caméraman',
      'PHOTOBOOK',
      'CADRE 30cm x 40cm',
      'LA VIDEO AVEC MONTAGE',
      'Les photos illimitées Sur Clé USB',
    ],
    photo: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800',
  },
  {
    name: 'عرسك علبنا',
    description: 'Forfait complet incluant photobook 20x30, vidéo complète 4K, projection de clip, cadre 30x40, drone, cortège, acte de mariage et photos illimitées sur clé USB.',
    price: 35000,
    features: [
      'PHOTOBOOK 20x30',
      'LA VIDEO COMPLET 4K',
      'PROJECTION DE CLIP',
      'CADRE 30X40',
      'DRONE',
      'CORTEGE',
      'ACTE DE MARIAGE',
      'LES PHOTO ILLIMITÉES SUR CLE USB',
    ],
    photo: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800',
  },
  {
    name: 'PACK ROYALE',
    description: 'Forfait royal avec photobook 20x30, album 100 photos 13x18, vidéo complète 4K, projection de clip, cadre 30x40, drone, cortège, acte de mariage et photos illimitées sur clé USB.',
    price: 47000,
    features: [
      'PHOTOBOOK 20x30',
      'ALBUM 100 PHOTO 13x18',
      'LA VIDEO COMPLET 4K',
      'PROJECTION DE CLIP',
      'CADRE 30X40',
      'DRONE',
      'CORTEGE',
      'ACTE DE MARIAGE',
      'LES PHOTO ILLIMITÉES SUR CLE USB',
    ],
    photo: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
  },
  {
    name: 'PACK Platinum',
    description: 'Forfait platine avec photobook 20x30, vidéo complète 4K, projection de clip, cadre 30x40, drone, cortège, acte de mariage, photos illimitées sur clé USB, fumée et feux d\'artifice laser.',
    price: 68000,
    features: [
      'PHOTOBOOK 20x30',
      'LA VIDEO COMPLET 4K',
      'PROJECTION DE CLIP',
      'CADRE 30X40',
      'DRONE',
      'CORTEGE',
      'ACTE DE MARIAGE',
      'LES PHOTO ILLIMITÉES SUR CLE USB',
      'FUMÉE ET LES FEUX D\'ARTIFICE LASER',
    ],
    photo: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800',
  },
  {
    name: 'MARIAGE DE RÊVE',
    description: 'Forfait mariage de rêve avec photobook 20x30, album 100 photos 13x18, cadre 30x40, 2 cadres 15x21cm, vidéo complète 4K, projection de clip, drone, cortège, acte de mariage, photos illimitées sur clé USB, fumée et feux d\'artifice laser.',
    price: 95000,
    features: [
      'PHOTOBOOK 20x30',
      'ALBUM 100 PHOTO 13x18',
      'CADRE 30X40',
      '2 CADRES 15.21cm',
      'LA VIDEO COMPLET 4K',
      'PROJECTION DE CLIP',
      'DRONE',
      'CORTEGE',
      'ACTE DE MARIAGE',
      'LES PHOTO ILLIMITÉES SUR CLE USB',
      'FUMÉE ET LES FEUX D\'ARTIFICE LASER',
    ],
    photo: 'https://images.unsplash.com/photo-1410013732736-fbceb15e064c?w=800',
  },
];

async function seedPacks() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    await Pack.deleteMany({});
    console.log('Cleared existing packs');

    const created = await Pack.insertMany(packs);
    console.log(`Successfully inserted ${created.length} packs:`);
    created.forEach(p => console.log(`  - ${p.name} (${p.price} DA)`));

    await mongoose.disconnect();
    console.log('Done - disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding packs:', error.message);
    process.exit(1);
  }
}

seedPacks();
