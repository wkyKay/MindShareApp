export type SamplePost = {
  id: number;
  title: string;
  author: string;
  summary: string;
};

export const samplePosts: SamplePost[] = [
  {
    id: 1,
    title: '雨夜重逢',
    author: '星河旅人',
    summary: '一个关于久别重逢与未寄出书信的短篇。',
  },
  {
    id: 2,
    title: '旧城花火合集更新',
    author: '白昼梦',
    summary: '新增第三章，主角终于回到旧城区。',
  },
];
