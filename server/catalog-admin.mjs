import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
const [folder, userId, role] = process.argv.slice(2);
if (!folder)
  throw new Error(
    'Usage: node server/catalog-admin.mjs /private/persistent/catalog-folder [user-id reader|editor|admin]',
  );
const dir = resolve(folder);
mkdirSync(dir, { recursive: true, mode: 0o700 });
const config = join(dir, 'config.json');
const id = userId ?? 'admin',
  permission = role ?? 'admin';
if (
  !/^[a-z0-9_-]+$/i.test(id) ||
  !['reader', 'editor', 'admin'].includes(permission)
)
  throw new Error('Invalid user or role');
const tokenFile = join(dir, id + '-token.txt');
if (existsSync(tokenFile)) throw new Error('User token file already exists');
let data;
if (userId) {
  if (!existsSync(config))
    throw new Error('Initialize the service folder first');
  data = JSON.parse(readFileSync(config, 'utf8'));
  if (data.users.some((u) => u.id === id))
    throw new Error('User already exists');
} else {
  if (existsSync(config)) throw new Error('Configuration already exists');
  data = {
    teamId: 'schematico-team',
    database: join(dir, 'catalog.sqlite'),
    host: '127.0.0.1',
    port: 4785,
    allowedOrigins: ['https://vitals5.github.io'],
    users: [],
  };
}
const token = randomBytes(32).toString('base64url');
data.users.push({
  id,
  role: permission,
  tokenHash: createHash('sha256').update(token).digest('hex'),
});
writeFileSync(tokenFile, token + '\n', { mode: 0o600, flag: 'wx' });
const temp = config + '.tmp';
writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' });
renameSync(temp, config);
process.stdout.write(
  'Private configuration and personal token file created. Token values are not printed. Restart the service to load changed users.\n',
);
