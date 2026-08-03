import { v4 as uuidv4 } from 'uuid';
import { db, User, Listing } from './database.js';
import { WalletService } from './services/orderAndWallet.js';

const walletService = new WalletService();

// Demo data for Nigerian locations
const NIGERIAN_LOCATIONS = {
  lagos: {
    city: 'Lagos Island',
    state: 'Lagos',
    country: 'Nigeria',
    coordinates: { latitude: 6.4274, longitude: 3.4197 },
  },
  ikeja: {
    city: 'Ikeja',
    state: 'Lagos',
    country: 'Nigeria',
    coordinates: { latitude: 6.5833, longitude: 3.3667 },
  },
  lekki: {
    city: 'Lekki',
    state: 'Lagos',
    country: 'Nigeria',
    coordinates: { latitude: 6.45, longitude: 3.5667 },
  },
  abuja: {
    city: 'Abuja Central Business District',
    state: 'Abuja',
    country: 'Nigeria',
    coordinates: { latitude: 9.0765, longitude: 7.3986 },
  },
  portharcourt: {
    city: 'Port Harcourt',
    state: 'Rivers',
    country: 'Nigeria',
    coordinates: { latitude: 4.7957, longitude: 7.0161 },
  },
  ibadan: {
    city: 'Ibadan',
    state: 'Oyo',
    country: 'Nigeria',
    coordinates: { latitude: 7.3964, longitude: 3.9476 },
  },
};

// Create developer admin user
const users: User[] = [
  {
    id: 'u-dev-admin',
    name: 'Developer Admin',
    email: 'developer@marketconnect.dev',
    role: 'admin',
    avatar: 'https://i.pravatar.cc/150?img=31',
    walletBalance: 0,
    accountNumber: 'MC-DEV-ADMIN',
    verified: true,
    verificationLevel: 'full',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Create demo listings
const listings: Listing[] = [
  {
    id: 'l1',
    sellerId: 'u2',
    sellerName: 'Emeka Electronics',
    title: 'Sony WH-1000XM5 Wireless Headphones',
    description:
      'Industry-leading noise cancelling headphones with 30-hour battery life. Perfect condition, original box included.',
    price: 185000,
    category: 'Electronics',
    location: NIGERIAN_LOCATIONS.lagos,
    images: ['https://picsum.photos/id/20/600/400', 'https://picsum.photos/id/180/600/400'],
    rating: 4.8,
    reviewCount: 42,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'l2',
    sellerId: 'u3',
    sellerName: 'Fatima Fashion',
    title: 'Authentic Gucci Leather Jacket',
    description:
      'Genuine Gucci leather jacket, size M. Perfect for autumn and winter. Excellent condition, authentic with certificate.',
    price: 750000,
    category: 'Fashion',
    location: NIGERIAN_LOCATIONS.abuja,
    images: ['https://picsum.photos/id/1005/600/400'],
    rating: 4.9,
    reviewCount: 28,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'l3',
    sellerId: 'u2',
    sellerName: 'Emeka Electronics',
    title: 'iPhone 15 Pro Max - 256GB Space Black',
    description: 'Latest iPhone 15 Pro Max, 256GB storage. Brand new, sealed box, international warranty.',
    price: 1450000,
    category: 'Electronics',
    location: NIGERIAN_LOCATIONS.ikeja,
    images: ['https://picsum.photos/id/160/600/400'],
    rating: 5.0,
    reviewCount: 15,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'l4',
    sellerId: 'u3',
    sellerName: 'Fatima Fashion',
    title: 'Premium Ankara Fabric - 5 Yards',
    description:
      'High-quality authentic African Ankara fabric. Perfect for traditional outfits. 5 yards in vibrant colors.',
    price: 25000,
    category: 'Fashion',
    location: NIGERIAN_LOCATIONS.lekki,
    images: ['https://picsum.photos/id/1010/600/400'],
    rating: 4.7,
    reviewCount: 89,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Seed the database
export function seedDatabase() {
  console.log('🌱 Seeding database...');

  // Add users
  users.forEach((user) => {
    db.addUser(user);
    // Create wallets for all users
    walletService.getOrCreateWallet(user.id);
  });

  console.log(`✅ Added ${users.length} users`);

  // Add listings
  listings.forEach((listing) => {
    db.addListing(listing);
  });

  console.log(`✅ Added ${listings.length} listings`);

  console.log('🎉 Database seeded successfully!');
}

// Run seed
seedDatabase();
