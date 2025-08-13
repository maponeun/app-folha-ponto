// App.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { 
    LucideClock, LucideCalendar, LucideUser, LucideFileText, 
    LucideBriefcase, LucideRoute, LucideDownload, LucideSave, 
    LucideXCircle, LucideCheckCircle, LucideAlertTriangle, LucideWifiOff,
    LucideLink
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';

// --- Configuração do Firebase ---
// **CORREÇÃO**: Removida a referência a `import.meta.env` para garantir compatibilidade com o ambiente.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Inicialização do Firebase ---
let app, db, auth;
try {
    if (firebaseConfig && firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } else {
        console.warn("Configuração do Firebase não encontrada. O App funcionará em modo offline.");
    }
} catch (error) {
    console.error("Erro na inicialização do Firebase:", error);
}

// --- Lógica de Geração de PDF (Integrada) ---
const pdfLogoUrl = "https://upload.wikimedia.org/wikipedia/commons/4/48/Bras%C3%A3o_de_Caruaru.png";
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const loadImageAsBase64 = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error("Falha ao carregar a imagem do logotipo."));
        img.src = url;
    });
};

const generatePdf = async (data) => {
    const { jsPDF } = window.jspdf;
    const { serverName, cpf, role, route, vinculo, selectedMonth, selectedYear, timeEntries } = data;

    try {
        const logoBase64 = await loadImageAsBase64(pdfLogoUrl);
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.addImage(logoBase64, 'PNG', 10, 8, 22, 22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('SECRETARIA DE EDUCAÇÃO E ESPORTES | GERÊNCIA GERAL DE TRANSPORTE', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text('FOLHA DE PONTO INDIVIDUAL', pageWidth / 2, 22, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const infoY = 38;
        
        const col1 = 38;
        const col2 = 110;
        const col3 = 160;

        const cargoCompleto = `${role || ''} / ${vinculo || ''}`;

        doc.text(`Servidor: ${serverName}`, col1, infoY);
        doc.text(`CPF: ${cpf}`, col2, infoY);
        doc.text(`Rota: ${route}`, col3, infoY);
        
        doc.text(`Cargo: ${cargoCompleto}`, col1, infoY + 6);
        doc.text(`Mês: ${selectedMonth}`, col2, infoY + 6);
        doc.text(`Ano: ${selectedYear}`, col3, infoY + 6);

        const tableBody = timeEntries.map(entry => {
            const isWeekend = ['Sábado', 'Domingo'].includes(entry.weekday);
            const isFullDayOff = ['Feriado', 'Ponto Facultativo', 'Folga', 'Falta', 'Atestado Médico', 'Recesso Escolar', 'Férias'].includes(entry.status);
            const rowStyle = (isWeekend || isFullDayOff) ? { fillColor: '#f0f0f0' } : {};
            
            if (isWeekend || isFullDayOff) {
                return [
                    { content: `${entry.day}, ${entry.weekday}`, styles: { fontStyle: 'bold', ...rowStyle } },
                    { content: entry.status || entry.weekday, colSpan: 8, styles: { halign: 'center', fontStyle: 'italic', textColor: '#555', ...rowStyle } }
                ];
            }
            return [
                { content: `${entry.day}, ${entry.weekday}`, styles: rowStyle },
                { content: entry.morning1Start, styles: rowStyle }, { content: entry.morning1End, styles: rowStyle },
                { content: entry.morning2Start, styles: rowStyle }, { content: entry.morning2End, styles: rowStyle },
                { content: entry.afternoon1Start, styles: rowStyle }, { content: entry.afternoon1End, styles: rowStyle },
                { content: entry.afternoon2Start, styles: rowStyle }, { content: entry.afternoon2End, styles: rowStyle },
            ];
        });

        doc.autoTable({
            startY: infoY + 12,
            head: [
                [{ content: 'Dia', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } }, { content: 'Manhã', colSpan: 4, styles: { halign: 'center' } }, { content: 'Tarde', colSpan: 4, styles: { halign: 'center' } }],
                ['Início', 'Fim', 'Início', 'Fim', 'Início', 'Fim', 'Início', 'Fim']
            ],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7 },
            styles: { fontSize: 7.5, cellPadding: 1.6, halign: 'center', lineWidth: 0.1, lineColor: [128, 128, 128] },
            columnStyles: { 0: { halign: 'left', cellWidth: 30, fontStyle: 'bold' } },
            didDrawPage: (data) => {
                const signatureY = pageHeight - 28;
                doc.line(20, signatureY, 90, signatureY);
                doc.text('Assinatura do Servidor', 55, signatureY + 4, { align: 'center' });
                doc.line(pageWidth - 90, signatureY, pageWidth - 20, signatureY);
                doc.text('Assinatura do Responsável pelo Setor', pageWidth - 55, signatureY + 4, { align: 'center' });
                const footerY = pageHeight - 18;
                doc.setFillColor(22, 101, 52);
                doc.rect(0, footerY, pageWidth, 18, 'F');
                doc.setFontSize(9);
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.text('SECRETARIA DE EDUCAÇÃO E ESPORTES', pageWidth / 2, footerY + 7, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.text('Avenida Cícero José Dutra, Petrópolis, Caruaru - PE - CEP 55030-580', pageWidth / 2, footerY + 12, { align: 'center' });
            },
            margin: { top: 30, bottom: 30 }
        });
        
        const nameParts = serverName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const formattedName = `${firstName}_${lastName}`.replace(/_$/, '');
        const fileName = `Ponto_${formattedName || 'Servidor'}_${selectedMonth}_${selectedYear}.pdf`;

        doc.save(fileName);
        return 'PDF gerado com sucesso!';

    } catch (error) {
        console.error("Erro na geração do PDF:", error);
        throw new Error('Erro ao gerar PDF. Verifique o console.');
    }
};

// --- Componentes Auxiliares de UI ---
const LoadingScreen = ({ text }) => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-gray-600">{text}</p>
        </div>
    </div>
);

const FirebaseErrorScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-800 p-4">
        <LucideWifiOff size={48} className="mb-4 text-red-600" />
        <h1 className="text-2xl font-bold text-center">Erro de Conexão</h1>
        <p className="mt-2 text-center max-w-md">Não foi possível conectar ao banco de dados (Firebase).</p>
        <p className="mt-4 text-sm text-center max-w-md bg-red-100 border border-red-200 p-3 rounded-lg">
            <strong>Para desenvolvedores:</strong> Verifique as configurações do Firebase. O App funcionará em modo offline.
        </p>
    </div>
);

// --- Componente Principal ---
export default function App() {
    const siteLogo = "https://upload.wikimedia.org/wikipedia/commons/4/48/Bras%C3%A3o_de_Caruaru.png";
    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

    // --- Estados ---
    const [firebaseStatus, setFirebaseStatus] = useState('pending');
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

    const [serverName, setServerName] = useState('');
    const [cpf, setCpf] = useState('');
    const [role, setRole] = useState('');
    const [route, setRoute] = useState('Regular');
    const [vinculo, setVinculo] = useState('Efetivo'); 
    
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [timeEntries, setTimeEntries] = useState([]);
    
    const docId = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    // --- Efeitos ---
    
    useEffect(() => {
        if (window.jspdf && window.jspdf.jsPDF.autoTable) {
            setScriptsLoaded(true);
            return;
        }

        const jspdfScript = document.createElement('script');
        jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jspdfScript.async = true;

        jspdfScript.onload = () => {
            const autotableScript = document.createElement('script');
            autotableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
            autotableScript.async = true;
            autotableScript.onload = () => setScriptsLoaded(true);
            document.body.appendChild(autotableScript);
        };
        document.body.appendChild(jspdfScript);
    }, []);

    useEffect(() => {
        setFirebaseStatus(db && auth ? 'success' : 'error');
    }, []);

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const createInitialTimeEntries = useCallback((year, month) => {
        const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
        const getWeekday = (y, m, d) => new Date(y, m, d).toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase());
        
        const daysInMonth = getDaysInMonth(year, month);
        return Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            return {
                day: day,
                weekday: getWeekday(year, month, day),
                morning1Start: '', morning1End: '', morning2Start: '', morning2End: '',
                afternoon1Start: '', afternoon1End: '', afternoon2Start: '', afternoon2End: '',
                status: '',
            };
        });
    }, []);

    useEffect(() => {
        if (firebaseStatus !== 'success' || !auth) {
            setIsAuthReady(true);
            setIsLoading(false);
            setTimeEntries(createInitialTimeEntries(selectedYear, selectedMonth));
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Erro no login:", error);
                    setNotification({ show: true, message: 'Falha na autenticação.', type: 'error' });
                }
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, [firebaseStatus, createInitialTimeEntries, selectedYear, selectedMonth]);

    useEffect(() => {
        if (!isAuthReady || !userId || firebaseStatus !== 'success') return;

        setIsLoading(true);
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/timesheets`, docId);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            const monthTemplate = createInitialTimeEntries(selectedYear, selectedMonth);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setServerName(data.serverName || '');
                setCpf(data.cpf || '');
                setRole(data.role || '');
                setRoute(data.route || 'Regular');
                setVinculo(data.vinculo || 'Efetivo'); 
                const savedEntries = data.timeEntries || [];
                const savedEntriesMap = new Map(savedEntries.map(e => [e.day, e]));
                setTimeEntries(monthTemplate.map(entry => savedEntriesMap.get(entry.day) || entry));
            } else {
                setServerName(''); setCpf(''); setRole(''); setRoute('Regular'); setVinculo('Efetivo');
                setTimeEntries(monthTemplate);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Erro ao carregar dados:", error);
            setNotification({ show: true, message: 'Erro ao carregar dados.', type: 'error' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [selectedMonth, selectedYear, isAuthReady, userId, appId, docId, createInitialTimeEntries, firebaseStatus]);

    const handleTimeChange = (index, period, value) => {
        const updatedEntries = [...timeEntries];
        updatedEntries[index][period] = value;
        setTimeEntries(updatedEntries);
    };
    
    const handleStatusChange = (index, value) => {
        const updatedEntries = [...timeEntries];
        updatedEntries[index].status = value;
        setTimeEntries(updatedEntries);
    };

    const handleClockClick = (index, period) => {
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        handleTimeChange(index, period, time);
    };

    const handleCpfChange = (e) => {
        const value = e.target.value.replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        setCpf(value.slice(0, 14));
    };

    const handleSave = async () => {
        if (firebaseStatus !== 'success' || !userId) {
            setNotification({ show: true, message: 'Não foi possível salvar. Verifique a conexão.', type: 'warn' });
            return;
        }
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/timesheets`, docId);
        const dataToSave = { serverName, cpf, role, route, vinculo, timeEntries: timeEntries || [] };
        try {
            await setDoc(docRef, dataToSave, { merge: true });
            setNotification({ show: true, message: 'Dados salvos com sucesso!', type: 'success' });
        } catch (error) {
            console.error("Erro ao salvar dados:", error);
            setNotification({ show: true, message: 'Erro ao salvar os dados.', type: 'error' });
        }
    };
    
    const handleGeneratePdf = () => {
        if (!scriptsLoaded) {
            setNotification({ show: true, message: 'Recursos para PDF ainda carregando. Tente novamente.', type: 'warn' });
            return;
        }
        const data = { serverName, cpf, role, route, vinculo, selectedMonth: months[selectedMonth], selectedYear, timeEntries };
        generatePdf(data)
            .then(message => setNotification({ show: true, message, type: 'success' }))
            .catch(error => setNotification({ show: true, message: error.message, type: 'error' }));
    };

    const NotificationComponent = () => {
        if (!notification.show) return null;
        const config = {
            info: { color: 'bg-blue-500', Icon: LucideAlertTriangle },
            success: { color: 'bg-green-500', Icon: LucideCheckCircle },
            warn: { color: 'bg-yellow-500', Icon: LucideAlertTriangle },
            error: { color: 'bg-red-500', Icon: LucideXCircle },
        };
        const { color, Icon } = config[notification.type];
        return (
            <div className={`fixed top-5 right-5 ${color} text-white py-2 px-4 rounded-lg shadow-lg flex items-center z-50 animate-fade-in-down`}>
                <Icon className="mr-2" />{notification.message}
            </div>
        );
    };

    if (firebaseStatus === 'pending' || isLoading) {
        return <LoadingScreen text={firebaseStatus === 'pending' ? 'Verificando conexão...' : 'Carregando dados...'} />;
    }
    
    return (
        <div className="bg-gray-50 min-h-screen font-sans text-gray-800">
            {firebaseStatus === 'error' && <FirebaseErrorScreen />}
            <NotificationComponent />
            <header className="bg-green-700 p-4 shadow-md sticky top-0 z-40">
                 <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between">
                    <div className="flex items-center mb-4 sm:mb-0">
                        <img src={siteLogo} alt="Brasão da Prefeitura de Caruaru" className="h-16 w-auto mr-4" />
                        <div className="flex flex-col justify-center">
                            <h1 className="text-white text-lg font-semibold">Secretaria de Educação e Esportes</h1>
                            <h2 className="text-green-200 text-sm">Gerência Geral do Transporte</h2>
                            <h3 className="text-white font-bold text-xl mt-1">Folha de Ponto Individual</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleSave} disabled={isLoading || firebaseStatus !== 'success'} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                            <LucideSave size={18} className="mr-2"/> Salvar
                        </button>
                        <button onClick={handleGeneratePdf} disabled={!scriptsLoaded || isLoading} className="bg-white text-green-700 font-bold py-2 px-4 rounded-lg shadow-md hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                            <LucideDownload size={18} className="mr-2"/> Gerar PDF
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-6">
                 <div className="bg-green-50/50 border border-green-200 p-6 rounded-xl shadow-sm mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-600 mb-1 flex items-center"><LucideUser size={14} className="mr-2"/>Servidor</label>
                            <input type="text" value={serverName} onChange={(e) => setServerName(e.target.value)} placeholder="Nome completo" className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-600 mb-1 flex items-center"><LucideFileText size={14} className="mr-2"/>CPF</label>
                            <input type="text" value={cpf} onChange={handleCpfChange} placeholder="000.000.000-00" className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-600 mb-1 flex items-center"><LucideBriefcase size={14} className="mr-2"/>Cargo</label>
                            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Cargo do servidor" className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-600 mb-1 flex items-center"><LucideLink size={14} className="mr-2"/>Vínculo</label>
                            <select value={vinculo} onChange={(e) => setVinculo(e.target.value)} className="p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500">
                                <option>Efetivo</option>
                                <option>Terceirizado</option>
                                <option>Seleção</option>
                                <option>RPA</option>
                                <option>MEI</option>
                                <option>Outro</option>
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-600 mb-1 flex items-center"><LucideRoute size={14} className="mr-2"/>Rota</label>
                            <select value={route} onChange={(e) => setRoute(e.target.value)} className="p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500">
                                <option>Regular</option><option>Integral</option><option>Regular + Integral</option><option>Outro</option>
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-600 mb-1 flex items-center"><LucideCalendar size={14} className="mr-2"/>Mês</label>
                            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500">
                                {months.map((month, index) => <option key={index} value={index}>{month}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm font-medium text-gray-600 mb-1 flex items-center"><LucideCalendar size={14} className="mr-2"/>Ano</label>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500">
                                {years.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="hidden md:block bg-white p-2 sm:p-4 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                    <table className="w-full min-w-[1200px]">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th rowSpan="2" className="p-3 text-left font-semibold text-gray-600 w-40 align-middle">Dia</th>
                                <th colSpan="4" className="p-3 text-center font-semibold text-gray-600">Manhã</th>
                                <th colSpan="4" className="p-3 text-center font-semibold text-gray-600">Tarde</th>
                                <th rowSpan="2" className="p-3 text-center font-semibold text-gray-600 w-48 align-middle">Status</th>
                            </tr>
                            <tr className="border-b border-gray-200 bg-gray-50 text-sm text-gray-500 font-medium">
                                <th className="p-2">Início</th><th className="p-2">Fim</th><th className="p-2">Início</th><th className="p-2">Fim</th>
                                <th className="p-2">Início</th><th className="p-2">Fim</th><th className="p-2">Início</th><th className="p-2">Fim</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timeEntries.map((entry, index) => {
                                const isWeekend = ['Sábado', 'Domingo'].includes(entry.weekday);
                                const isFullDayOff = ['Feriado', 'Ponto Facultativo', 'Folga', 'Falta', 'Atestado Médico', 'Recesso Escolar', 'Férias'].includes(entry.status);
                                const isWorkDisabled = isWeekend || isFullDayOff;
                                return (
                                <tr key={`desktop-${entry.day}`} className={`border-b border-gray-100 last:border-b-0 transition-colors ${isWorkDisabled ? 'bg-gray-100' : 'hover:bg-green-50/30'}`}>
                                    <td className="p-3"><div className="font-bold">{String(entry.day).padStart(2, '0')}</div><div className="text-xs text-gray-500">{entry.weekday}</div></td>
                                    {isWorkDisabled ? (<td colSpan="8" className="p-2 text-center text-gray-500 font-semibold italic">{entry.status || entry.weekday}</td>) : (<>
                                        {['morning1Start', 'morning1End', 'morning2Start', 'morning2End', 'afternoon1Start', 'afternoon1End', 'afternoon2Start', 'afternoon2End'].map((period) => (
                                            <td key={period} className="p-2 text-center">
                                                <div className="flex items-center justify-center">
                                                    <input type="time" value={entry[period] || ''} onChange={(e) => handleTimeChange(index, period, e.target.value)} className="w-24 p-1 border border-gray-300 rounded-md text-center bg-white focus:ring-1 focus:ring-green-500"/>
                                                    <button onClick={() => handleClockClick(index, period)} className="ml-2 text-gray-400 hover:text-green-600" title="Preencher hora atual"><LucideClock size={18} /></button>
                                                </div>
                                            </td>
                                        ))}
                                    </>)}
                                    <td className="p-2 text-center">
                                        {!isWeekend && (<select value={entry.status} onChange={(e) => handleStatusChange(index, e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-green-500 text-sm">
                                            <option value=""></option><option value="Feriado">Feriado</option><option value="Ponto Facultativo">Ponto Facultativo</option><option value="Folga">Folga</option><option value="Falta">Falta</option><option value="Atestado Médico">Atestado Médico</option><option value="Recesso Escolar">Recesso Escolar</option><option value="Férias">Férias</option><option value="Presença Parcial">Presença Parcial</option>
                                        </select>)}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                <div className="md:hidden space-y-4">
                    {timeEntries.map((entry, index) => {
                        const isWeekend = ['Sábado', 'Domingo'].includes(entry.weekday);
                        const isFullDayOff = ['Feriado', 'Ponto Facultativo', 'Folga', 'Falta', 'Atestado Médico', 'Recesso Escolar', 'Férias'].includes(entry.status);
                        const isWorkDisabled = isWeekend || isFullDayOff;
                        return (
                        <div key={`mobile-${entry.day}`} className={`bg-white p-4 rounded-xl shadow-sm border ${isWorkDisabled ? 'bg-gray-100' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <div><p className="font-bold text-lg">{String(entry.day).padStart(2, '0')}</p><p className="text-sm text-gray-500">{entry.weekday}</p></div>
                                {!isWeekend && (<select value={entry.status} onChange={(e) => handleStatusChange(index, e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-green-500 text-sm">
                                    <option value=""></option><option value="Feriado">Feriado</option><option value="Ponto Facultativo">Ponto Facultativo</option><option value="Folga">Folga</option><option value="Falta">Falta</option><option value="Atestado Médico">Atestado Médico</option><option value="Recesso Escolar">Recesso Escolar</option><option value="Férias">Férias</option><option value="Presença Parcial">Presença Parcial</option>
                                </select>)}
                            </div>
                            {isWorkDisabled ? (<p className="text-center text-gray-500 font-semibold italic">{entry.status || entry.weekday}</p>) : (
                            <div className="grid grid-cols-2 gap-4">
                                {['morning1Start', 'morning1End', 'morning2Start', 'morning2End', 'afternoon1Start', 'afternoon1End', 'afternoon2Start', 'afternoon2End'].map((period, pIndex) => (
                                    <div key={period}>
                                        <label className="text-xs text-gray-500">{Math.floor(pIndex / 4) === 0 ? 'Manhã' : 'Tarde'} - {pIndex % 2 === 0 ? 'Início' : 'Fim'} {Math.floor(pIndex/2) % 2 + 1}</label>
                                        <div className="flex items-center">
                                            <input type="time" value={entry[period] || ''} onChange={(e) => handleTimeChange(index, period, e.target.value)} className="w-full p-1 border border-gray-300 rounded-md text-center bg-white focus:ring-1 focus:ring-green-500"/>
                                            <button onClick={() => handleClockClick(index, period)} className="ml-2 text-gray-400 hover:text-green-600" title="Preencher hora atual"><LucideClock size={18} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </div>
                    )})}
                </div>

                <footer className="text-center mt-6 text-sm text-gray-500">
                    <p>ID de Usuário: <span className="font-mono text-xs bg-gray-200 px-1 py-0.5 rounded">{userId || 'N/A'}</span></p>
                    <p>Status da Conexão: 
                        {firebaseStatus === 'success' && <span className="text-green-600 font-semibold"> Conectado</span>}
                        {firebaseStatus === 'error' && <span className="text-red-600 font-semibold"> Erro de Conexão</span>}
                    </p>
                    <p className="mt-2">App de Folha de Ponto &copy; {new Date().getFullYear()}</p>
                </footer>
            </main>
        </div>
    );
}
