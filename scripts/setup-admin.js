const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupAdmin() {
  try {
    console.log('🔧 Setting up admin user...');
    
    const adminEmail = 'moinkhan.datori1235@gmail.com';
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });
    
    if (existingUser) {
      // Update existing user to admin
      const updatedUser = await prisma.user.update({
        where: { email: adminEmail },
        data: { role: 'ADMIN' }
      });
      console.log(`✅ User ${adminEmail} has been updated to ADMIN role`);
    } else {
      // Create new admin user
      const newAdminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          name: 'Admin User',
          role: 'ADMIN',
          credits: 1000, // Give admin some initial credits
          isActive: true
        }
      });
      console.log(`✅ New admin user created: ${adminEmail}`);
    }
    
    console.log('🎉 Admin setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  setupAdmin();
}

module.exports = { setupAdmin };