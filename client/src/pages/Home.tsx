import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrendingUsers from "@/components/TrendingUsers";
import Features from "@/components/Features";
import FAQ from "@/components/FAQ";
import Security from "@/components/Security";
import Footer from "@/components/Footer";

/**
 * Home Page - Main landing page for ConnectLive
 * Design: Vibrant, modern video chat platform
 * Sections: Hero, Trending Users, Features, FAQ, Footer
 */
export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  // Redirect authenticated users directly to chat — no need to go through login
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation('/chat');
    }
  }, [isAuthenticated, loading, setLocation]);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <TrendingUsers />
      <Features />
      <FAQ />
      <Security />
      <Footer />
    </div>
  );
}
