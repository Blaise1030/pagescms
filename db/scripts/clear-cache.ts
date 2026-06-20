import { db } from '../index';
import {
  cacheFileMetaTable,
  cacheFileTable,
  cachePermissionTable,
  configTable,
} from '../schema';

console.log('Clearing cache tables...');

db.transaction(async (tx) => {
  await tx.delete(cacheFileTable);
  await tx.delete(cachePermissionTable);
  await tx.delete(configTable);
  await tx.delete(cacheFileMetaTable);
})
  .then(() => {
    console.log('✅ Cache tables cleared successfully');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  });
