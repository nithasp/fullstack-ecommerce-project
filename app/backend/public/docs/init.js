window.ui = SwaggerUIBundle({
  url: '/openapi.yaml',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: true,
  displayRequestDuration: true,
  docExpansion: 'none',
  filter: true,
  tryItOutEnabled: true,
  presets: [SwaggerUIBundle.presets.apis],
  layout: 'BaseLayout',
});
