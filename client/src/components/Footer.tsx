import { Mail, Phone, MapPin, Video } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

/**
 * Footer Component
 * Design: Professional footer with links, contact info, and social media
 * Features: Multiple columns with organized information
 */

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-gradient-to-b from-gray-900 to-black text-white py-16">
      <div className="container mx-auto px-4">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Video className="w-6 h-6 text-white" />
              </div>
              <span className="font-display text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                ConnectLive
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t('home.hero_desc')}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
                  {t('nav.home') || 'Home'}
                </a>
              </li>
              <li>
                <a href="#features" className="text-gray-400 hover:text-purple-400 transition-colors">
                  {t('nav.features')}
                </a>
              </li>
              <li>
                <a href="#faq" className="text-gray-400 hover:text-purple-400 transition-colors">
                  {t('nav.faq')}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <a href="#security" className="text-gray-400 hover:text-purple-400 transition-colors">
                  {t('nav.security')}
                </a>
              </li>
              <li>
                <button onClick={() => window.location.href = '/store'} className="text-gray-400 hover:text-purple-400 transition-colors">
                  {t('nav.store')}
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-bold text-lg mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <a href="mailto:info@connectlive.com" className="text-gray-400 hover:text-purple-400 transition-colors">
                  info@connectlive.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <a href="tel:+1234567890" className="text-gray-400 hover:text-purple-400 transition-colors">
                  +1 (234) 567-890
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <span className="text-gray-400">
                  World
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 my-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Copyright */}
          <p className="text-gray-400 text-sm text-center md:text-left">
            © 2026 ConnectLive. All rights reserved.
          </p>

          {/* Social Links */}
          <div className="flex gap-6 mt-6 md:mt-0">
            <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 002.856-3.51 10 10 0 01-2.856.175 10 10 0 003.71 1.231 10 10 0 01-3.71 1.231 10 10 0 002.856 3.51 10 10 0 01-2.856-3.51 10 10 0 003.71-1.231 10 10 0 01-3.71-1.231z" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-purple-400 transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm3.7-10c0 2.05-1.65 3.7-3.7 3.7s-3.7-1.65-3.7-3.7 1.65-3.7 3.7-3.7 3.7 1.65 3.7 3.7z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
