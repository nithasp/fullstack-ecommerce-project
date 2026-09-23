import { Request, Response, Router } from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');

const cache = new Map<string, string>();

const read = (file: string): string => {
  const cached = cache.get(file);
  if (cached !== undefined) return cached;

  const contents = fs.readFileSync(path.join(ROOT, file), 'utf8');
  cache.set(file, contents);
  return contents;
};

const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';

// helmet's default policy is `script-src 'self'`, which would block the CDN bundle, so the
// docs page gets its own policy instead of loosening it for the whole API
const docsCsp = helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    baseUri: ["'self'"],
  },
});

const DOCS_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Storefront API — Reference</title>
    <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
    <link rel="stylesheet" href="/docs/theme.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js" crossorigin></script>
    <script src="/docs/init.js"></script>
  </body>
</html>
`;

const sendFile = (file: string, type: string) => (_req: Request, res: Response) => {
  try {
    res.type(type).send(read(file));
  } catch {
    res.status(500).json({ status: 500, message: 'That documentation file is unavailable', data: null });
  }
};

const router = Router();

router.get('/openapi.yaml', sendFile('openapi.yaml', 'application/yaml'));
router.get('/docs/init.js', sendFile('public/docs/init.js', 'application/javascript'));
router.get('/docs/theme.css', sendFile('public/docs/theme.css', 'text/css'));
router.get('/docs', docsCsp, (_req: Request, res: Response) => {
  res.type('html').send(DOCS_PAGE);
});

export default router;
