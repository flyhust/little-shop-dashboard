import React from 'react';
import { createRoot } from 'react-dom/client';
import { Store } from './store';
import App from './App';
import LiveApp from './LiveApp';
import './styles.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><Store>{new URLSearchParams(location.search).get('live')==='1'?<LiveApp/>:<App/>}</Store></React.StrictMode>);
