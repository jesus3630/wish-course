import React, { useState, useEffect } from 'react';
import './index.css';
import { CourseProgress, Module, QuizQuestion } from './types';
import { getProgress, createProgress, saveProgress } from './utils/progress';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ModulePlayer from './components/ModulePlayer';
import AdminPanel from './components/AdminPanel';

type AppView = 'login' | 'dashboard' | 'module';

const isAdmin = window.location.pathname === '/admin';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);
  const [modules, setModules] = useState<Module[]>([]);
  const [quizData, setQuizData] = useState<Record<string, QuizQuestion[]>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch course and quiz data from server
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

  useEffect(() => {
    if (isAdmin) return;
    const saved = getProgress();
    if (saved) {
      setProgress(saved);
      setView('dashboard');
    }
  }, []);

  function handleLogin(name: string, email: string) {
    const p = createProgress(name, email);
    saveProgress(p);
    setProgress(p);
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

  function handleModuleComplete(updated: CourseProgress) {
    saveProgress(updated);
    setProgress(updated);
    setView('dashboard');
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
      />
    );
  }

  return null;
}
