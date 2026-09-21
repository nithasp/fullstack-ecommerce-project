import app from './app';
import { config } from './config';

// Kept apart from app.ts so tests can import the app without opening a port
app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
