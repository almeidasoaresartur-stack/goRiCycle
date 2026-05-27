export const DISCLAIMER_TITLE = "Aviso de Isenção de Responsabilidade (Disclaimer)";

export const DISCLAIMER_SHORT =
  "O goRiCycle é uma plataforma informativa. Não garantimos a disponibilidade imediata dos stocks nem a precisão em tempo real dos preços, que são recolhidos de forma automatizada. Não assumimos qualquer responsabilidade por insatisfação com a compra ou litígios comerciais nos sites externos para os quais o utilizador é redirecionado.";

export const DISCLAIMER_PARAGRAPHS = [
  DISCLAIMER_SHORT,
  "Ao navegar e utilizar este site, o utilizador reconhece que qualquer contrato de compra e venda é celebrado exclusivamente entre si e a loja parceira final escolhida. Os preços apresentados reflectem os dados recolhidos no último scrape e podem divergir ligeiramente do valor actual no site de destino.",
] as const;

export const NFPM_FOOTNOTE =
  "*NFPM: Dados de capacidade/memória não fornecidos previamente pela loja na listagem original.";

export const FRESHNESS_POLICY_TITLE = "Como garantimos a frescura dos preços?";

export const FRESHNESS_POLICY_PARAGRAPHS = [
  "Os nossos sistemas realizam uma actualização automática dos dados directamente nos sites parceiros uma vez por dia, com uma verificação completa e profunda (Full Update) todos os domingos através de fluxos automatizados (GitHub Actions).",
  "Embora nos esforcemos ao máximo para apresentar os preços o mais actualizados possível, o goRiCycle não se responsabiliza por alterações repentinas de preço, flutuações de stock ou erros cometidos pelas próprias lojas parceiras antes da nossa próxima sincronização diária.",
] as const;
