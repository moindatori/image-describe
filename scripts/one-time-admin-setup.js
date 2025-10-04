const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function oneTimeAdminSetup() {
  try {
    console.log('🚀 One-time admin setup starting...');
    
    const adminEmail = 'moinkhan.datori1235@gmail.com';
    
    // Check if user already exists and is admin
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });
    
    if (existingUser && existingUser.role === 'ADMIN') {
      console.log(`ℹ️  User ${adminEmail} is already an admin. No changes needed.`);
      return;
    }
    
    if (existingUser) {
      // Update existing user to admin
      await prisma.user.update({
        where: { email: adminEmail },
        data: { 
          role: 'ADMIN',
          credits: Math.max(existingUser.credits, 1000) // Ensure at least 1000 credits
        }
      });
      console.log(`✅ User ${adminEmail} has been promoted to ADMIN role`);
    } else {
      // Create new admin user
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: 'Admin User',
          role: 'ADMIN',
          credits: 1000,
          isActive: true
        }
      });
      console.log(`✅ New admin user created: ${adminEmail}`);
    }
    
    // Verify the admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true, email: true, role: true, credits: true, createdAt: true }
    });
    
    console.log('📋 Admin user details:');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Credits: ${adminUser.credits}`);
    console.log(`   Created: ${adminUser.createdAt}`);
    
    console.log('🎉 One-time admin setup completed successfully!');
    console.log('💡 You can now sign in with this email to access admin features.');
    
  } catch (error) {
    console.error('❌ Error in one-time admin setup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

oneTimeAdminSetup();