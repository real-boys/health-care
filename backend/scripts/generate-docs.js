const fs = require('fs');
const path = require('path');

const generateOpenAPI = () => {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Healthcare API',
      version: '1.0.0',
      description: 'API documentation for the Healthcare Platform',
    },
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };

  const routesDir = path.join(__dirname, '../routes');
  const files = fs.readdirSync(routesDir);

  files.forEach(file => {
    if (file.endsWith('.js')) {
      const routeName = file.replace('.js', '');
      spec.paths[`/api/${routeName}`] = {
        get: {
          summary: `Get ${routeName}`,
          responses: {
            200: { description: 'Success' },
          },
        },
        post: {
          summary: `Create ${routeName}`,
          responses: {
            201: { description: 'Created' },
          },
        },
      };
    }
  });

  fs.writeFileSync(path.join(__dirname, '../docs/openapi.json'), JSON.stringify(spec, null, 2));
  console.log('API documentation generated at backend/docs/openapi.json');
};

generateOpenAPI();
