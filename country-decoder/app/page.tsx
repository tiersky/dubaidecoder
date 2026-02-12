"use client";

import { useState } from "react";
import { Country } from "@/types";
import { countries } from "@/data/countries";
import { perceptionScores } from "@/data/perceptions";
import DashboardLayout from "@/components/templates/DashboardLayout";
import Sidebar from "@/components/organisms/Sidebar";
import GlobalOverview from "@/components/templates/GlobalOverview";
import CountryDetail from "@/components/templates/CountryDetail";
import BudgetAllocation from "@/components/templates/BudgetAllocation";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<"global" | "budget">("global");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
    if (currentTab === "budget") {
      setCurrentTab("global");
    }
  };

  const handleBack = () => {
    setSelectedCountry(null);
  };

  const handleTabChange = (tab: "global" | "budget") => {
    setCurrentTab(tab);
    if (tab === "budget") {
      setSelectedCountry(null);
    }
  };

  return (
    <DashboardLayout
      currentTab={currentTab}
      onTabChange={handleTabChange}
      sidebar={
        <Sidebar
          countries={countries}
          selectedCountry={selectedCountry}
          onSelectCountry={handleSelectCountry}
        />
      }
    >
      {currentTab === "global" && !selectedCountry && (
        <GlobalOverview
          countries={countries}
          perceptionScores={perceptionScores}
          onSelectCountry={handleSelectCountry}
        />
      )}

      {currentTab === "global" && selectedCountry && (
        <CountryDetail
          key={selectedCountry.code}
          country={selectedCountry}
          onBack={handleBack}
        />
      )}

      {currentTab === "budget" && (
        <BudgetAllocation allCountries={countries} />
      )}
    </DashboardLayout>
  );
}
