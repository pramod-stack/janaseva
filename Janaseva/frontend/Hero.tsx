import React from "react";
import { motion } from "framer-motion";

const Hero = () => {
  // Staggered animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover [transform:scaleY(-1)]"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260302_085640_276ea93b-d7da-4418-a09b-2aa5b490e838.mp4"
            type="video/mp4"
          />
        </video>
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(255,255,255,0)] from-[26.416%] to-white to-[66.943%]" />
      </div>

      {/* Navbar (Reused from existing homepage) */}
      <nav className="fixed w-full z-50 top-0 transition-all duration-300 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                JS
              </div>
              <div>
                <h1 className="font-bold text-xl leading-none text-brand-blue tracking-tight">
                  Jana Seva
                </h1>
                <p className="text-xs text-gray-500 font-medium tracking-wide uppercase mt-1">
                  Online Service Center
                </p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#services"
                className="text-gray-600 hover:text-brand-blue font-medium transition-colors"
              >
                Services
              </a>
              <a
                href="#certificates"
                className="text-gray-600 hover:text-brand-blue font-medium transition-colors"
              >
                Certificates
              </a>
              <a
                href="#how-it-works"
                className="text-gray-600 hover:text-brand-blue font-medium transition-colors"
              >
                How it works
              </a>
              <a
                href="#testimonials"
                className="text-gray-600 hover:text-brand-blue font-medium transition-colors"
              >
                Reviews
              </a>
              <a
                href="tel:7760449027"
                className="bg-brand-orange text-white px-6 py-2.5 rounded-full font-semibold hover:bg-orange-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <i className="fas fa-phone-alt text-sm"></i> Call Now
              </a>
              <a
                href="dashboard.html"
                className="text-brand-blue border border-brand-blue px-5 py-2 rounded-full font-semibold hover:bg-blue-50 transition-colors"
              >
                Login
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-4">
              <a href="tel:7760449027" className="text-brand-orange text-xl">
                <i className="fas fa-phone-alt"></i>
              </a>
              <button className="text-gray-600 hover:text-brand-blue focus:outline-none">
                <i className="fas fa-bars text-2xl"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Content Container */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 pt-[290px] flex flex-col items-center text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center gap-8 w-full"
        >
          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-brand-dark font-medium tracking-[-0.04em] text-5xl md:text-[80px] leading-[1.1] max-w-4xl font-['Geist']"
          >
            Simple{" "}
            <span className="italic font-normal md:text-[100px] font-['Instrument_Serif']">
              management
            </span>{" "}
            for your remote team
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-[#373a46] opacity-80 text-[18px] max-w-[554px] font-['Geist']"
          >
            We help you navigate complex paperwork with ease. Get your documents
            processed quickly and accurately without the hassle.
          </motion.p>

          {/* Input + CTA Block */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center w-full"
          >
            <div className="flex flex-col sm:flex-row items-center bg-[#fcfcfc] rounded-[40px] border border-gray-100 shadow-[0px_10px_40px_5px_rgba(194,194,194,0.25)] p-2 w-full max-w-[480px]">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-transparent border-none outline-none px-6 py-3 text-gray-700 placeholder:text-gray-400 w-full font-['Geist']"
              />
              <button className="w-full sm:w-auto bg-gradient-to-b from-gray-700 to-brand-dark text-white rounded-[32px] px-8 py-3.5 font-medium shadow-[inset_-4px_-6px_25px_0px_rgba(201,201,201,0.08),inset_4px_4px_10px_0px_rgba(29,29,29,0.24)] hover:opacity-90 transition-opacity whitespace-nowrap font-['Geist']">
                Create Free Account
              </button>
            </div>

            {/* Social Proof */}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex text-yellow-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className="w-5 h-5 drop-shadow-sm"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-gray-600 font-medium text-sm font-['Geist']">
                1,020+ Reviews
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
