# Enhanced Token Creation Features

## Overview

The FloppFun platform now supports advanced token creation features that give creators more control over their token economics while maintaining fair launch principles. These features include configurable supply, creator allocations, token locking, and optional prebuy functionality.

## New Features

### 1. **Configurable Total Supply**
- **Range**: 100K to 1B tokens
- **Default**: 1B tokens (existing behavior)
- **Purpose**: Allows creators to set custom token supply based on their project needs

### 2. **Creator Share Allocation**
- **Range**: 0% to 80% of total supply
- **Default**: 0% (fully fair launch)
- **Recommended**: 20% (for maintaining community trust)
- **Purpose**: Allocate tokens to creator for development, marketing, or team rewards
- **Note**: Higher percentages may reduce community trust

### 3. **Token Locking Mechanism**
- **Lock Percentage**: 0% to 100% of creator tokens
- **Lock Duration**: 30 days, 90 days, 6 months, 1 year, 2 years
- **Unlock Schedules**:
  - **Immediate**: All tokens unlocked immediately
  - **Cliff**: All tokens unlock at the end of lock period
  - **Linear**: Gradual monthly unlocks over the lock period

### 4. **Optional Prebuy**
- **Range**: 0 to 10 SOL
- **Purpose**: Creator can buy tokens immediately after creation
- **Pricing**: Uses initial bonding curve pricing

## Database Schema Changes

### New Columns in `tokens` Table
```sql
total_supply_custom BIGINT DEFAULT 1000000000
creator_share_percentage DECIMAL(5,2) DEFAULT 0.0
creator_tokens_allocated BIGINT DEFAULT 0
creator_tokens_locked BIGINT DEFAULT 0
creator_tokens_unlocked BIGINT DEFAULT 0
lock_percentage DECIMAL(5,2) DEFAULT 0.0
lock_duration_days INTEGER DEFAULT 0
lock_start_date TIMESTAMP WITH TIME ZONE
next_unlock_date TIMESTAMP WITH TIME ZONE
prebuy_sol_amount DECIMAL(10,4) DEFAULT 0.0
prebuy_tokens_received BIGINT DEFAULT 0
creation_settings JSONB DEFAULT '{}'
```

### New Tables

#### `token_locks`
Tracks individual token lock records:
```sql
id UUID PRIMARY KEY
token_id UUID REFERENCES tokens(id)
locked_amount BIGINT NOT NULL
lock_type TEXT ('creator', 'team', 'liquidity', 'marketing')
lock_duration_days INTEGER NOT NULL
unlock_date TIMESTAMP WITH TIME ZONE NOT NULL
status TEXT ('locked', 'partially_unlocked', 'fully_unlocked')
```

#### `token_unlock_schedule`
Manages gradual unlock schedules:
```sql
id UUID PRIMARY KEY
token_lock_id UUID REFERENCES token_locks(id)
unlock_date TIMESTAMP WITH TIME ZONE NOT NULL
unlock_percentage DECIMAL(5,2) NOT NULL
unlock_amount BIGINT NOT NULL
status TEXT ('pending', 'completed')
```

## Implementation Details

### Token Economics Calculation

```typescript
// Example: 1B tokens, 10% creator share, 50% locked for 1 year
const economics = TokenEconomicsService.calculateTokenEconomics({
  totalSupply: 1000000000,
  creatorSharePercentage: 10,
  lockPercentage: 50
})

// Results:
// totalSupply: 1,000,000,000
// creatorShare: 100,000,000 (10%)
// lockedTokens: 50,000,000 (5% of total)
// unlockedTokens: 50,000,000 (5% of total)
// marketSupply: 900,000,000 (90% for trading)
```

### Token Creation Flow

1. **User Interface**: Enhanced form with advanced settings
2. **Validation**: Client and server-side validation of parameters
3. **Token Creation**: Standard SPL token creation on Solana
4. **Database Storage**: Save token with advanced economics data
5. **Lock Creation**: Create lock records if applicable
6. **Prebuy Execution**: Execute prebuy trade if requested

### Security Considerations

#### Fair Launch Protection
- Creator share limited to 20% maximum
- Market supply must be at least 80% of total supply
- Lock periods enforce commitment from creators

#### Economic Validation
- Total supply bounds prevent extreme values
- Lock percentages validated (0-100%)
- Duration limits prevent excessively long locks

## User Interface

### Advanced Settings Section
The token creation form now includes:

1. **Total Supply Input**
   - Number input with validation
   - Placeholder showing default value
   - Helper text explaining limits

2. **Creator Share Configuration**
   - Percentage input (0-20%)
   - Automatic calculation of token amounts
   - Real-time summary display

3. **Token Locking Settings**
   - Lock percentage slider/input
   - Duration dropdown selection
   - Unlock schedule selection

4. **Creation Summary**
   - Real-time calculation display
   - Shows all token allocations
   - Validation error display

5. **Optional Prebuy**
   - SOL amount input
   - Estimated token calculation
   - Cost breakdown

## API Usage

### Create Token with Advanced Features
```typescript
const tokenData: TokenCreationData = {
  name: "My Advanced Token",
  symbol: "ADV",
  description: "A token with advanced economics",
  totalSupply: 5000000000, // 5B tokens
  creatorSharePercentage: 15, // 15% to creator
  lockPercentage: 75, // 75% of creator tokens locked
  lockDurationDays: 365, // 1 year lock
  prebuyAmount: 1.5, // 1.5 SOL prebuy
  unlockSchedule: "linear" // Gradual unlock
}

const result = await tokenService.createToken(tokenData)
```

### Query Token Economics
```typescript
const economics = await TokenEconomicsService.getTokenEconomics(tokenId)
const locks = await TokenEconomicsService.getTokenLocks(tokenId)
const lockedValue = await TokenEconomicsService.getLockedTokenValue(tokenId)
```

## Migration Guide

### Existing Tokens
- All existing tokens maintain current behavior
- New fields default to 0 (no creator allocation)
- No breaking changes to existing functionality

### Database Migration
Run the SQL script:
```bash
# Apply the enhanced schema
supabase sql --file supabase/sql/04-enhance-token-creation.sql
```

## Best Practices

### For Token Creators

#### Recommended Settings for Fair Launch
- **Creator Share**: 0-10% for maximum fairness
- **Lock Percentage**: 100% if taking any creator share
- **Lock Duration**: Minimum 6 months for credibility
- **Unlock Schedule**: Linear for gradual distribution

#### Trust Building
- **Transparency**: Clearly communicate token economics
- **Commitment**: Lock tokens to show long-term commitment
- **Fair Distribution**: Keep creator allocation reasonable

### For Platform Operators

#### Monitoring
- Track average creator share percentages
- Monitor lock compliance and unlock schedules
- Analyze prebuy patterns for insights

#### Governance
- Consider adjusting maximum creator share based on feedback
- Implement additional validation rules if needed
- Monitor for economic manipulation attempts

## Examples

### Fair Launch Token (Recommended)
```typescript
{
  totalSupply: 1000000000,
  creatorSharePercentage: 5,
  lockPercentage: 100,
  lockDurationDays: 365,
  prebuyAmount: 0,
  unlockSchedule: "linear"
}
```

### Community Focused Token
```typescript
{
  totalSupply: 10000000000,
  creatorSharePercentage: 0,
  lockPercentage: 0,
  lockDurationDays: 0,
  prebuyAmount: 0.5,
  unlockSchedule: "immediate"
}
```

### Project Development Token
```typescript
{
  totalSupply: 2000000000,
  creatorSharePercentage: 15,
  lockPercentage: 80,
  lockDurationDays: 730,
  prebuyAmount: 2,
  unlockSchedule: "cliff"
}
```

## Troubleshooting

### Common Validation Errors

1. **"Total supply must be between 100K and 1B tokens"**
   - Adjust total supply to be within valid range

2. **"Creator share cannot exceed 80%"**
   - Reduce creator share percentage to 80% or less

3. **"Warning: Creator shares above 20% may reduce community trust"**
   - Consider reducing creator share to 20% or less for better community reception

4. **"Market supply should be at least 50% of total supply for high creator allocations"**
   - Ensure adequate market supply when using high creator percentages

5. **"Lock percentage must be between 0% and 100%"**
   - Set valid lock percentage value

### Database Issues

1. **Missing columns errors**
   - Ensure database migration has been applied
   - Check column names match schema

2. **Permission errors**
   - Verify RLS policies are properly configured
   - Check user authentication status

## Future Enhancements

### Planned Features
1. **Multi-tier Lock Schedules**: Different unlock schedules for different purposes
2. **Governance Integration**: Community voting on unlock schedules
3. **Advanced Vesting**: Time-based and milestone-based vesting
4. **Secondary Markets**: Trading of locked tokens as derivatives
5. **Analytics Dashboard**: Comprehensive token economics analytics

### Integration Points
1. **Smart Contract Evolution**: Move to on-chain lock enforcement
2. **DEX Integration**: Automatic liquidity provision from unlocks
3. **Cross-chain Bridges**: Support for multi-chain token economics
4. **DeFi Protocols**: Integration with lending and staking protocols

## Conclusion

The enhanced token creation features provide creators with powerful tools to design sophisticated token economics while maintaining the fair launch principles that make FloppFun unique. These features enable more professional project launches while preserving community trust through transparency and economic validation.

The implementation balances flexibility with safety, ensuring that while creators have more options, the fundamental fairness and community-driven nature of the platform remains intact. 