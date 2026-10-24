import {PhoneCompanion} from './components/PhoneCompanion';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(window.location.pathname.replace(/\/+$/,'')==='/phone'?<PhoneCompanion />:<App />);
