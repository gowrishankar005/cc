import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';

@Resolver()
export class AccountsResolver {
  @Query()
  account(@Args('id') id: string): string {
    return `account ${id}`;
  }

  @Mutation()
  createAccount(@Args('name') name: string): string {
    return `created ${name}`;
  }
}
