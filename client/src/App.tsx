import React, { useState, useEffect } from 'react';
import './index.css';
import { CourseProgress, Module, QuizQuestion } from './types';
import { getProgress, createProgress, saveProgress, syncProgressToServer, fetchProgressFromServer, clearProgress } from './utils/progress';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ModulePlayer from './components/ModulePlayer';
import AdminPanel from './components/AdminPanel';
import Certificate from './components/Certificate';

type AppView = 'login' | 'dashboard' | 'module';

const isAdmin = window.location.pathname === '/admin';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);
  const [modules, setModules] = useState<Module[]>([]);
  const [quizData, setQuizData] = useState<Record<string, QuizQuestion[]>>({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    if (isAdmin) { setDataLoaded(true); return; }
    Promise.all([
      fetch('/api/course').then(r => r.json()),
      fetch('/api/quiz').then(r => r.json()),
    ]).then(([courseData, quizJson]) => {
      setModules(courseData as Module[]);
      setQuizData(quizJson as Record<string, QuizQuestion[]>);
      setDataLoaded(true);
    }).catch(err => {
      console.error('Failed to load course data:', err);
      setDataLoaded(true);
    });
  }, []);

  // Resume session from localStorage, then refresh from server
  useEffect(() => {
    if (isAdmin) return;
    const saved = getProgress();
    if (saved) {
      setProgress(saved);
      setView('dashboard');
      fetchProgressFromServer(saved.user_email).then(serverProgress => {
        if (serverProgress) {
          const merged = { ...serverProgress, user_name: saved.user_name };
          saveProgress(merged);
          setProgress(merged);
        }
      });
    }
  }, []);

  async function handleLogin(name: string, email: string): Promise<string | null> {
    try {
      const loginRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (loginRes.status === 403) return 'not_on_roster';
      if (!loginRes.ok) return null;
    } catch {
      return null;
    }
    const serverProgress = await fetchProgressFromServer(email);
    const p = serverProgress
      ? { ...serverProgress, user_name: name }
      : createProgress(name, email);
    saveProgress(p);
    setProgress(p);
    if (!serverProgress) syncProgressToServer(p);
    setView('dashboard');
    return null;
  }

  function handleStartModule(index: number) {
    setActiveModuleIndex(index);
    setView('module');
  }

  function handleProgressUpdate(updated: CourseProgress) {
    saveProgress(updated);
    setProgress(updated);
    syncProgressToServer(updated);
  }

  async function handleLogout() {
    if (progress) await syncProgressToServer(progress);
    clearProgress();
    setProgress(null);
    setView('login');
  }

  function handleModuleComplete(updated: CourseProgress) {
    saveProgress(updated);
    setProgress(updated);
    syncProgressToServer(updated);
    const allComplete = modules.every(m => updated.modules[m.id]?.completed === true);
    if (allComplete) {
      setShowCertificate(true);
    } else {
      setView('dashboard');
    }
  }

  if (isAdmin) {
    return <AdminPanel />;
  }

  if (!dataLoaded) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '18px', color: '#1B3A6B', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>Loading...</div>
      </div>
    );
  }

  if (view === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (showCertificate && progress) {
    return <Certificate progress={progress} modules={modules} onClose={() => setShowCertificate(false)} />;
  }

  if (view === 'module' && progress) {
    return (
      <ModulePlayer
        module={modules[activeModuleIndex]}
        moduleIndex={activeModuleIndex}
        totalModules={modules.length}
        progress={progress}
        quizData={quizData}
        onProgressUpdate={handleProgressUpdate}
        onComplete={handleModuleComplete}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (progress) {
    return (
      <Dashboard
        modules={modules}
        progress={progress}
        onStartModule={handleStartModule}
        onLogout={handleLogout}
        onViewCertificate={() => setShowCertificate(true)}
      />
    );
  }

  return null;
}
