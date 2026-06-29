interface StockPageSchemaProps {
  symbol: string;
  name: string;
  description?: string;
  sector?: string;
  exchange?: string;
}

/**
 * JSON-LD Schema for individual stock analysis pages.
 * Uses FinancialProduct schema type for SEO optimization.
 */
export function StockPageSchema({ 
  symbol, 
  name, 
  description, 
  sector, 
  exchange 
}: StockPageSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "@id": `https://www.claritx.ai/stocks/${symbol}`,
    "name": `${symbol} Deep Research`,
    "url": `https://www.claritx.ai/stocks/${symbol}`,
    "description": description || `AI-powered research and analysis for ${name} (${symbol})`,
    "category": sector || "Stock",
    "provider": {
      "@id": "https://www.claritx.ai/#organization",
    },
    "isRelatedTo": {
      "@type": "Corporation",
      "name": name,
      "tickerSymbol": symbol,
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
