export const PAYOUT_VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function distribute(address[] calldata recipients, uint256[] calldata amounts) external",
  "function userDeposits(address user) external view returns (uint256)",
  "function totalPooled() external view returns (uint256)",
  "event Deposited(address indexed user, uint256 amount)",
  "event Withdrawn(address indexed user, uint256 amount)",
  "event Distributed(address[] recipients, uint256[] amounts)",
] as const;

export const HAT_TOKEN_ABI = [
  "function batchMint(address[] calldata recipients, uint256[] calldata amounts) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "event BatchMinted(address[] recipients, uint256[] amounts, uint256 totalMinted)",
] as const;
