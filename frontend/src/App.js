import React from 'react';
import { Toaster } from './components/ui/sonner';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import EventInfo from './components/EventInfo';
import RunnersSection from './components/RunnersSection';
import VolunteersSection from './components/VolunteersSection';
import Rules from './components/Rules';
import Logistics from './components/Logistics';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import './App.css';

export default function App() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <EventInfo />
      <RunnersSection />
      <VolunteersSection />
      <Rules />
      <Logistics />
      <FAQ />
      <Footer />
      <Toaster />
    </div>
  );
}