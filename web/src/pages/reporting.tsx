import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/chapters/events',
    permanent: false
  }
});

export default function ReportingRedirectPage() {
  return null;
}
