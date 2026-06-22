import React, { useState, useEffect } from 'react';
import './index.css';
// v2026-06-02 cache-bust
import { CourseProgress, Module, QuizQuestion } from './types';
import { getProgress, createProgress, saveProgress, clearProgress, fetchProgressFromServer } from './utils/progress';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ModulePlayer from './components/ModulePlayer';
import AdminPanel from './components/AdminPanel';
import Certificate from './components/Certificate';

type AppView = 'login' | 'dashboard' | 'module';
const _BUILD = '20260602';

const isAdmin = window.location.pathname === '/admin';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);
  const [jumpSlide, setJumpSlide] = useState<number | undefined>(undefined);
  const [modules, setModules] = useState<Module[]>([]);
  const [quizData, setQuizData] = useState<Record<string, QuizQuestion[]>>({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    if (isAdmin) { setDataLoaded(true); return; }
    Promise.all([
      fetch('/api/course?nc=' + Date.now()).then(r => r.json()),
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

  // SSO auto-login: when embedded in WISH ESS, a signed ?sso= token identifies the
  // employee — verify it, load their assigned modules, and skip the login screen.
  useEffect(() => {
    if (isAdmin) return;
    const token = new URLSearchParams(window.location.search).get('sso');
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) return; // fall through to normal login
        const d = await res.json();
        if (!d.email) return;
        let p = await fetchProgressFromServer(d.email).catch(() => null);
        if (!p) p = createProgress(d.name || 'Trainee', d.email, d.assigned_modules ?? null);
        if (d.assigned_modules) p.assigned_modules = d.assigned_modules;
        saveProgress(p);
        setProgress(p);
        setView('dashboard');
      } catch { /* fall through to normal login */ }
    })();
  }, []);

  // Resume session from localStorage
  useEffect(() => {
    if (isAdmin) return;
    const saved = getProgress();
    if (saved) {
      setProgress(saved);
      setView('dashboard');
    }
  }, []);

  function handleEnter() {
    const existing = getProgress();
    if (existing) {
      setProgress(existing);
    } else {
      // Anonymous session — random ID stored in localStorage
      const anonId = 'anon_' + Math.random().toString(36).slice(2, 10);
      const p = createProgress('Trainee', anonId + '@wish.local', null);
      saveProgress(p);
      setProgress(p);
    }
    setView('dashboard');
  }

  function handleStartModule(index: number, slide?: number) {
    setActiveModuleIndex(index);
    setJumpSlide(slide);
    setView('module');
  }

  function handleProgressUpdate(updated: CourseProgress) {
    saveProgress(updated);
    setProgress(updated);
  }

  function handleLogout() {
    clearProgress();
    setProgress(null);
    setView('login');
  }

  const visibleModules = progress?.assigned_modules
    ? modules.filter(m => progress.assigned_modules!.includes(m.id))
    : modules;

  function handleModuleComplete(updated: CourseProgress) {
    saveProgress(updated);
    setProgress(updated);
    const assignedMods = updated.assigned_modules ? modules.filter(m => updated.assigned_modules!.includes(m.id)) : modules;
    const allComplete = assignedMods.every(m => updated.modules[m.id]?.completed === true);
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
        <div style={{ fontSize: '18px', color: '#1B3A6B', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }} data-v={_BUILD}>Loading...</div>
      </div>
    );
  }

  if (view === 'login') {
    return <LoginScreen onEnter={handleEnter} />;
  }

  if (showCertificate && progress) {
    return <Certificate progress={progress} modules={visibleModules} onClose={() => setShowCertificate(false)} />;
  }

  if (view === 'module' && progress) {
    return (
      <ModulePlayer
        module={visibleModules[activeModuleIndex]}
        moduleIndex={activeModuleIndex}
        totalModules={visibleModules.length}
        progress={progress}
        quizData={quizData}
        onProgressUpdate={handleProgressUpdate}
        onComplete={handleModuleComplete}
        onBack={() => setView('dashboard')}
        initialSlide={jumpSlide}
      />
    );
  }

  if (progress) {
    return (
      <Dashboard
        modules={visibleModules}
        progress={progress}
        onStartModule={handleStartModule}
        onLogout={handleLogout}
        onViewCertificate={() => setShowCertificate(true)}
      />
    );
  }

  return null;
}
