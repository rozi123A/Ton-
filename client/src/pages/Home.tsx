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
