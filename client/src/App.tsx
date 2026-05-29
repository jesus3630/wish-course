import React, { useState, useEffect } from 'react';
import './index.css';
// v2026-05-28 cache-bust
import { CourseProgress, Module, QuizQuestion } from './types';
import { getProgress, createProgress, saveProgress, clearProgress } from './utils/progress';
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
      fetch('/api/course?v=2').then(r => r.json()),
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

  function handleStartModule(index: number) {
    setActiveModuleIndex(index);
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
        <div style={{ fontSize: '18px', color: '#1B3A6B', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>Loading...</div>
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
        userName={progress.user_name}
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
