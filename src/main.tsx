import {PhoneCompanion} from './components/PhoneCompanion';
import {SimulationDemo} from './components/SimulationDemo';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const route=window.location.pathname.replace(/\/+$/,'');
createRoot(document.getElementById('root')!).render(route==='/simulation'?<SimulationDemo/>:route==='/phone'?<PhoneCompanion />:<App />);
