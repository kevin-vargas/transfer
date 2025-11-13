import { Injectable } from '@nestjs/common';

interface Item {
  id: number;
  name: string;
  description: string;
  createdAt: string;
}

@Injectable()
export class AppService {
  private readonly items: Item[] = [
    {
      id: 1,
      name: 'Sample Item 1',
      description: 'This is a sample item from the API service',
      createdAt: new Date('2024-01-01').toISOString(),
    },
    {
      id: 2,
      name: 'Sample Item 2',
      description: 'Another example item with different data',
      createdAt: new Date('2024-01-15').toISOString(),
    },
    {
      id: 3,
      name: 'Sample Item 3',
      description: 'Third item to show list functionality',
      createdAt: new Date('2024-02-01').toISOString(),
    },
  ];

  getItems(): Item[] {
    return this.items;
  }
}