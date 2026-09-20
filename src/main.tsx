import React from 'react';
import ReactDOM from 'react-dom/client';
import './fonts.css';
import './styles.css';
import './invitations.css';
import './adventure.css';
import './invitation-experience.css';
import './entry-splash.css';
import './teo-credit.css';
import './wall.css';
import './character-reactions.css';
import App from './App';
import { registerPushBadgeReset } from './pushBadge';

registerPushBadgeReset();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
