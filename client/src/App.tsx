import React, { useState, useEffect } from 'react';
import './index.css';
import { CourseProgress, Module } from './types';
import { getProgress, createProgress, saveProgress } from './utils/progress';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import ModulePlayer from './components/ModulePlayer';
import courseData from './data/course_data.json';

const modules = courseData as Module[];

type AppView = 'login' | 'dashboard' | 'module';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState<number>(0);

  useEffect(() => {
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
